import type { Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { isUniqueConstraintError } from "../../lib/prisma-errors";
import { digestSecret } from "../../middleware/organization-auth";
import { canonicalJson } from "../consent/manifest";

const LEASE_DURATION_MS = 60 * 1_000;
const CLAIM_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CONTINUATION_EVENT_FIELDS = [
  "type",
  "protocol_version",
  "event_id",
  "correlation_id",
  "binding_id",
  "issuer_origin",
  "workflow_id",
  "event_type",
  "event_sequence",
  "state_version",
  "occurred_at",
  "canonical_url",
] as const;

const deliverySelect = {
  deliveryId: true,
  eventId: true,
  grantId: true,
  deliveryTargetId: true,
  status: true,
  maximumAttempts: true,
  currentAttempt: true,
  currentConnectorId: true,
  currentClaimTokenDigest: true,
  currentLeaseTokenDigest: true,
  leaseStartedAt: true,
  leaseExpiresAt: true,
  terminalReason: true,
  event: {
    select: {
      eventId: true,
      grantId: true,
      bindingId: true,
      correlationId: true,
      issuerOrigin: true,
      workflowId: true,
      eventType: true,
      eventSequence: true,
      stateVersion: true,
      occurredAt: true,
      canonicalUrl: true,
      canonicalBody: true,
    },
  },
  grant: {
    select: {
      id: true,
      accountId: true,
      connectorId: true,
      deliveryTargetId: true,
      bindingId: true,
      correlationId: true,
      issuerOrigin: true,
      workflowId: true,
      eventType: true,
      canonicalUrl: true,
      humanBoundary: true,
      expiresAt: true,
      revokedAt: true,
    },
  },
} as const;

type DeliveryRecord = Prisma.DeliveryGetPayload<{ select: typeof deliverySelect }>;

type DeliveryCandidate = {
  delivery_id: string;
  status: string;
  current_attempt: number;
};

type ConnectorIdentity = {
  id: string;
  accountId: string;
  deliveryTargetId: string;
  expiresAt: Date;
};

export class DeliveryError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(code);
    this.name = "DeliveryError";
  }
}

function requireClaimToken(value: string): string {
  if (!CLAIM_TOKEN_PATTERN.test(value)) {
    throw new DeliveryError("claim_token_invalid", 400);
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== value) {
    throw new DeliveryError("claim_token_invalid", 400);
  }
  return value;
}

function assertExactKeys(value: Record<string, unknown>, expected: readonly string[]): void {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) {
    throw new DeliveryError("delivery_private_state_invalid", 500);
  }
}

function readCanonicalEvent(delivery: DeliveryRecord): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(delivery.event.canonicalBody);
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      canonicalJson(parsed) !== delivery.event.canonicalBody
    ) {
      throw new Error("event body is not canonical");
    }
  } catch {
    throw new DeliveryError("delivery_private_state_invalid", 500);
  }

  const event = parsed as Record<string, unknown>;
  assertExactKeys(event, CONTINUATION_EVENT_FIELDS);
  if (
    event.type !== "webmcp.continuation_event" ||
    event.protocol_version !== "0.1" ||
    event.event_id !== delivery.event.eventId ||
    event.correlation_id !== delivery.event.correlationId ||
    event.binding_id !== delivery.event.bindingId ||
    event.issuer_origin !== delivery.event.issuerOrigin ||
    event.workflow_id !== delivery.event.workflowId ||
    event.event_type !== delivery.event.eventType ||
    event.event_sequence !== delivery.event.eventSequence ||
    event.state_version !== Number(delivery.event.stateVersion) ||
    event.occurred_at !== delivery.event.occurredAt.toISOString() ||
    event.canonical_url !== delivery.event.canonicalUrl
  ) {
    throw new DeliveryError("delivery_private_state_invalid", 500);
  }
  return event;
}

function assertDeliveryContext(delivery: DeliveryRecord): void {
  if (
    delivery.eventId !== delivery.event.eventId ||
    delivery.grantId !== delivery.grant.id ||
    delivery.event.grantId !== delivery.grant.id ||
    delivery.deliveryTargetId !== delivery.grant.deliveryTargetId ||
    delivery.grant.bindingId !== delivery.event.bindingId ||
    delivery.grant.correlationId !== delivery.event.correlationId ||
    delivery.grant.issuerOrigin !== delivery.event.issuerOrigin ||
    delivery.grant.workflowId !== delivery.event.workflowId ||
    delivery.grant.eventType !== delivery.event.eventType ||
    delivery.grant.canonicalUrl !== delivery.event.canonicalUrl
  ) {
    throw new DeliveryError("delivery_private_state_invalid", 500);
  }
}

function buildLeaseResult(
  delivery: DeliveryRecord,
  claimToken: string,
  duplicate: boolean,
  connectorExpiresAt: Date,
  now: Date
): Record<string, unknown> {
  assertDeliveryContext(delivery);
  const event = readCanonicalEvent(delivery);
  const leaseExpiresAt = delivery.leaseExpiresAt;
  if (!leaseExpiresAt || leaseExpiresAt <= now) {
    throw new DeliveryError("delivery_private_state_invalid", 500);
  }

  const grantExpiresAt = delivery.grant.expiresAt;
  if (
    leaseExpiresAt.getTime() > grantExpiresAt.getTime() ||
    leaseExpiresAt.getTime() > connectorExpiresAt.getTime()
  ) {
    throw new DeliveryError("delivery_private_state_invalid", 500);
  }

  const receipt = {
    type: "webmcp.continuation_receipt",
    protocol_version: "0.1",
    grant_id: delivery.grant.id,
    correlation_id: delivery.grant.correlationId,
    issuer_origin: delivery.grant.issuerOrigin,
    workflow_id: delivery.grant.workflowId,
    event_type: delivery.grant.eventType,
    canonical_url: delivery.grant.canonicalUrl,
    expires_at: grantExpiresAt.toISOString(),
    human_boundary: delivery.grant.humanBoundary,
    continuation_mode: "open_canonical_page_read_current_state",
  };

  return {
    duplicate,
    lease: {
      type: "webmcp.delivery_lease",
      protocol_version: "0.1",
      delivery_id: delivery.deliveryId,
      event_id: delivery.eventId,
      attempt: delivery.currentAttempt,
      lease_token: claimToken,
      lease_expires_at: leaseExpiresAt.toISOString(),
      continuation: {
        correlation_id: event.correlation_id,
        workflow_id: event.workflow_id,
        event_type: event.event_type,
        event_sequence: event.event_sequence,
        state_version: event.state_version,
        occurred_at: event.occurred_at,
        canonical_url: event.canonical_url,
      },
      receipt,
    },
  };
}

function assertConnectorScope(
  connector: ConnectorIdentity,
  delivery: DeliveryRecord
): void {
  if (
    delivery.deliveryTargetId !== connector.deliveryTargetId ||
    delivery.grant.connectorId !== connector.id ||
    delivery.grant.accountId !== connector.accountId
  ) {
    throw new DeliveryError("connector_delivery_scope_invalid", 403);
  }
}

async function resolveConnector(
  transaction: Prisma.TransactionClient,
  connectorToken: string,
  now: Date
): Promise<ConnectorIdentity> {
  const connector = await transaction.connector.findUnique({
    where: { tokenDigest: digestSecret(connectorToken) },
    select: { id: true, accountId: true, deliveryTargetId: true, expiresAt: true, revokedAt: true },
  });
  if (!connector || connector.revokedAt !== null || connector.expiresAt <= now) {
    throw new DeliveryError("connector_identity_invalid", 403);
  }
  return connector;
}

async function lockTarget(
  transaction: Prisma.TransactionClient,
  deliveryTargetId: string
): Promise<void> {
  await transaction.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${deliveryTargetId}, 0))
  `;
}

async function findClaimCandidate(
  transaction: Prisma.TransactionClient,
  deliveryTargetId: string,
  now: Date
): Promise<DeliveryCandidate | null> {
  const candidates = await transaction.$queryRaw<DeliveryCandidate[]>`
    SELECT
      d."delivery_id",
      d."status",
      d."current_attempt"
    FROM "cr2_deliveries" d
    INNER JOIN "cr2_grants" g ON g."grant_id" = d."grant_id"
    WHERE d."delivery_target_id" = ${deliveryTargetId}
      AND d."status" IN ('pending', 'leased')
      AND (
        d."status" = 'pending'
        OR d."lease_expires_at" <= ${now}
      )
      AND g."revoked_at" IS NULL
      AND g."expires_at" > ${now}
    ORDER BY d."created_at" ASC, d."delivery_id" ASC
    LIMIT 1
    FOR UPDATE OF d
    SKIP LOCKED
  `;
  return candidates[0] ?? null;
}

export async function claimDelivery(
  connectorToken: string,
  claimToken: string
): Promise<Record<string, unknown> | null> {
  const validatedClaimToken = requireClaimToken(claimToken);
  const claimTokenDigest = digestSecret(validatedClaimToken);

  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const connector = await resolveConnector(transaction, connectorToken, now);

    // One advisory lock per fixed delivery target serializes claims without a
    // process-local mutex and lets the transaction re-check the committed
    // state after a competing claim finishes.
    await lockTarget(transaction, connector.deliveryTargetId);

    const previousAttempt = await transaction.deliveryAttempt.findUnique({
      where: { claimTokenDigest },
      select: {
        attempt: true,
        connectorId: true,
        delivery: { select: deliverySelect },
      },
    });
    if (previousAttempt) {
      if (previousAttempt.connectorId !== connector.id) {
        throw new DeliveryError("delivery_lease_scope_invalid", 403);
      }
      const delivery = previousAttempt.delivery;
      if (
        delivery.currentAttempt !== previousAttempt.attempt ||
        delivery.currentClaimTokenDigest !== claimTokenDigest
      ) {
        throw new DeliveryError("claim_token_retired", 409);
      }
      assertConnectorScope(connector, delivery);
      if (delivery.status === "leased" && delivery.leaseExpiresAt && delivery.leaseExpiresAt > now) {
        return buildLeaseResult(delivery, validatedClaimToken, true, connector.expiresAt, now);
      }
      throw new DeliveryError("claim_token_retired", 409);
    }

    const activeLease = await transaction.delivery.findFirst({
      where: {
        deliveryTargetId: connector.deliveryTargetId,
        status: "leased",
        leaseExpiresAt: { gt: now },
      },
      select: { deliveryId: true },
    });
    if (activeLease) return null;

    const candidate = await findClaimCandidate(transaction, connector.deliveryTargetId, now);
    if (!candidate) return null;

    const delivery = await transaction.delivery.findUnique({
      where: { deliveryId: candidate.delivery_id },
      select: deliverySelect,
    });
    if (!delivery) throw new DeliveryError("delivery_claim_race", 409);
    assertConnectorScope(connector, delivery);

    if (delivery.status === "pending") {
      if (delivery.currentAttempt !== 0) {
        throw new DeliveryError("delivery_state_invalid", 500);
      }
    } else if (delivery.status === "leased") {
      if (!delivery.leaseExpiresAt || delivery.leaseExpiresAt > now) {
        throw new DeliveryError("delivery_claim_race", 409);
      }
      if (delivery.currentAttempt >= delivery.maximumAttempts) {
        const exhausted = await transaction.delivery.updateMany({
          where: {
            deliveryId: delivery.deliveryId,
            status: "leased",
            currentAttempt: delivery.currentAttempt,
            currentConnectorId: delivery.currentConnectorId,
            currentClaimTokenDigest: delivery.currentClaimTokenDigest,
            currentLeaseTokenDigest: delivery.currentLeaseTokenDigest,
            leaseExpiresAt: delivery.leaseExpiresAt,
          },
          data: {
            status: "retry_exhausted",
            terminalReason: "attempt_limit_reached",
            updatedAt: now,
          },
        });
        if (exhausted.count !== 1) {
          throw new DeliveryError("delivery_claim_race", 409);
        }
        return null;
      }
    } else {
      throw new DeliveryError("delivery_state_invalid", 500);
    }

    const leaseExpiresAtMs = Math.min(
      now.getTime() + LEASE_DURATION_MS,
      delivery.grant.expiresAt.getTime(),
      connector.expiresAt.getTime()
    );
    if (!Number.isFinite(leaseExpiresAtMs) || leaseExpiresAtMs <= now.getTime()) {
      throw new DeliveryError("connector_identity_invalid", 403);
    }
    const leaseStartedAt = now;
    const leaseExpiresAt = new Date(leaseExpiresAtMs);
    const attempt = delivery.currentAttempt + 1;
    const updated = await transaction.delivery.updateMany({
      where: {
        deliveryId: delivery.deliveryId,
        status: delivery.status,
        currentAttempt: delivery.currentAttempt,
        currentConnectorId: delivery.currentConnectorId,
        currentClaimTokenDigest: delivery.currentClaimTokenDigest,
        currentLeaseTokenDigest: delivery.currentLeaseTokenDigest,
        leaseExpiresAt: delivery.leaseExpiresAt,
      },
      data: {
        status: "leased",
        currentAttempt: attempt,
        currentConnectorId: connector.id,
        currentClaimTokenDigest: claimTokenDigest,
        currentLeaseTokenDigest: claimTokenDigest,
        leaseStartedAt,
        leaseExpiresAt,
        terminalReason: null,
        updatedAt: now,
      },
    });
    if (updated.count !== 1) {
      throw new DeliveryError("delivery_claim_race", 409);
    }

    try {
      await transaction.deliveryAttempt.create({
        data: {
          deliveryId: delivery.deliveryId,
          connectorId: connector.id,
          attempt,
          claimTokenDigest,
          leaseTokenDigest: claimTokenDigest,
          leaseStartedAt,
          leaseExpiresAt,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DeliveryError("claim_token_retired", 409);
      }
      throw error;
    }

    return buildLeaseResult(
      {
        ...delivery,
        status: "leased",
        currentAttempt: attempt,
        currentConnectorId: connector.id,
        currentClaimTokenDigest: claimTokenDigest,
        currentLeaseTokenDigest: claimTokenDigest,
        leaseStartedAt,
        leaseExpiresAt,
        terminalReason: null,
      },
      validatedClaimToken,
      false,
      connector.expiresAt,
      now
    );
  });
}
