import { createHash, randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../../db";
import { isUniqueConstraintError } from "../../lib/prisma-errors";
import type { ClaimPairingSession, DisconnectConnector } from "./pairing.schemas";

const PAIRING_LIFETIME_MS = 10 * 60 * 1_000;
const CONNECTOR_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_FAILED_CLAIMS_BEFORE_TERMINAL = 5;
const TERMINAL_FAILED_CLAIMS = MAX_FAILED_CLAIMS_BEFORE_TERMINAL + 1;
const MAX_CODE_GENERATION_ATTEMPTS = 10;

export class PairingError extends Error {
  constructor(
    public readonly code: string,
    public readonly statusCode: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
    this.name = "PairingError";
  }
}

export type PairingCreated = {
  type: "webmcp.connector_account_pairing";
  protocol_version: "0.1";
  pairing_id: string;
  pairing_code: string;
  expires_at: string;
};

export type ConnectorSummary = {
  connector_id: string;
  pairing_id: string;
  device_name: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};

export type ConnectorList = {
  type: "webmcp.connector_account_connectors";
  protocol_version: "0.1";
  connectors: ConnectorSummary[];
};

export type ConnectorCredentials = {
  type: "webmcp.connector_credentials";
  protocol_version: "0.1";
  pairing_id: string;
  connector_id: string;
  connector_expires_at: string;
  duplicate: boolean;
  connector_token?: string;
};

export type ConnectorDisconnected = {
  type: "webmcp.connector_disconnection";
  protocol_version: "0.1";
  status: "disconnected";
  duplicate: boolean;
};

type PairingClaimResult =
  | ConnectorCredentials
  | { failure: "pairing_not_found" | "pairing_expired" };

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function newPairingCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

function newConnectorToken(): string {
  return randomBytes(32).toString("base64url");
}

function createdResponse(id: string, code: string, expiresAt: Date): PairingCreated {
  return {
    type: "webmcp.connector_account_pairing",
    protocol_version: "0.1",
    pairing_id: id,
    pairing_code: code,
    expires_at: expiresAt.toISOString(),
  };
}

function duplicateResponse(
  pairing: { id: string; accountId: string; connector: {
    id: string;
    accountId: string;
    pairingSessionId: string;
    expiresAt: Date;
  } | null }
): ConnectorCredentials {
  const connector = pairing.connector;
  if (
    !connector ||
    connector.accountId !== pairing.accountId ||
    connector.pairingSessionId !== pairing.id
  ) {
    throw new PairingError("account_pairing_identity_conflict", 409);
  }
  return {
    type: "webmcp.connector_credentials",
    protocol_version: "0.1",
    pairing_id: pairing.id,
    connector_id: connector.id,
    connector_expires_at: connector.expiresAt.toISOString(),
    duplicate: true,
  };
}

export async function createPairingSession(accountId: string): Promise<PairingCreated> {
  const account = await prisma.userAccount.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!account) throw new PairingError("session_required", 401);

  const now = Date.now();
  const expiresAt = new Date(now + PAIRING_LIFETIME_MS);

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const code = newPairingCode();
    try {
      const pairing = await prisma.pairingSession.create({
        data: {
          accountId,
          pairingCodeDigest: digest(code),
          expiresAt,
        },
      });
      return createdResponse(pairing.id, code, expiresAt);
    } catch (error) {
      if (isUniqueConstraintError(error)) continue;
      throw error;
    }
  }

  throw new PairingError("receiver_busy", 503);
}

export async function listAccountConnectors(accountId: string): Promise<ConnectorList> {
  const connectors = await prisma.connector.findMany({
    where: { accountId },
    select: {
      id: true,
      pairingSessionId: true,
      deviceName: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    type: "webmcp.connector_account_connectors",
    protocol_version: "0.1",
    connectors: connectors.map((connector) => ({
      connector_id: connector.id,
      pairing_id: connector.pairingSessionId,
      device_name: connector.deviceName,
      created_at: connector.createdAt.toISOString(),
      expires_at: connector.expiresAt.toISOString(),
      revoked_at: connector.revokedAt?.toISOString() ?? null,
    })),
  };
}

export async function claimPairingSession(
  input: ClaimPairingSession
): Promise<ConnectorCredentials> {
  const codeDigest = digest(input.pairing_code);
  const now = new Date();

  const result = await prisma.$transaction<PairingClaimResult>(async (transaction) => {
    const pairing = await transaction.pairingSession.findUnique({
      where: { id: input.pairing_id },
      include: { connector: true },
    });

    if (!pairing) throw new PairingError("pairing_not_found", 404);
    if (pairing.consumedAt) {
      if (pairing.pairingCodeDigest === codeDigest) return duplicateResponse(pairing);
      throw new PairingError("pairing_not_found", 404);
    }
    if (pairing.expiresAt <= now || pairing.failedAttempts >= TERMINAL_FAILED_CLAIMS) {
      throw new PairingError("pairing_expired", 410);
    }

    if (pairing.pairingCodeDigest !== codeDigest) {
      const incremented = await transaction.$queryRaw<Array<{ failed_attempts: number }>>`
        UPDATE "cr2_pairing_sessions"
        SET "failed_attempts" = "failed_attempts" + 1
        WHERE "pairing_id" = ${pairing.id}
          AND "consumed_at" IS NULL
          AND "expires_at" > ${now}
          AND "failed_attempts" < ${TERMINAL_FAILED_CLAIMS}
        RETURNING "failed_attempts"
      `;

      if (incremented.length === 1) {
        const failedAttempts = Number(incremented[0].failed_attempts);
        if (failedAttempts >= TERMINAL_FAILED_CLAIMS) {
          return { failure: "pairing_expired" };
        }
        return { failure: "pairing_not_found" };
      }

      const current = await transaction.pairingSession.findUnique({
        where: { id: pairing.id },
        include: { connector: true },
      });
      if (current?.consumedAt) {
        return { failure: "pairing_not_found" };
      }
      return { failure: "pairing_expired" };
    }

    const consumed = await transaction.pairingSession.updateMany({
      where: {
        id: pairing.id,
        consumedAt: null,
        expiresAt: { gt: now },
        failedAttempts: { lt: TERMINAL_FAILED_CLAIMS },
      },
      data: { consumedAt: now },
    });

    if (consumed.count !== 1) {
      const current = await transaction.pairingSession.findUnique({
        where: { id: pairing.id },
        include: { connector: true },
      });
      if (current?.consumedAt) return duplicateResponse(current);
      throw new PairingError("pairing_expired", 410);
    }

    const connectorToken = newConnectorToken();
    const connector = await transaction.connector.create({
      data: {
        accountId: pairing.accountId,
        pairingSessionId: pairing.id,
        deliveryTargetId: randomUUID(),
        tokenDigest: digest(connectorToken),
        deviceName: input.device_name,
        expiresAt: new Date(now.getTime() + CONNECTOR_LIFETIME_MS),
      },
    });

    return {
      type: "webmcp.connector_credentials",
      protocol_version: "0.1",
      pairing_id: pairing.id,
      connector_id: connector.id,
      connector_token: connectorToken,
      connector_expires_at: connector.expiresAt.toISOString(),
      duplicate: false,
    };
  });

  if ("failure" in result) {
    throw new PairingError(result.failure, result.failure === "pairing_expired" ? 410 : 404);
  }
  return result;
}

export async function disconnectConnector(
  input: DisconnectConnector
): Promise<ConnectorDisconnected> {
  const tokenDigest = digest(input.connector_token);
  const revoked = await prisma.connector.updateMany({
    where: {
      tokenDigest,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  if (revoked.count === 0) {
    const connector = await prisma.connector.findUnique({
      where: { tokenDigest },
      select: { revokedAt: true },
    });
    if (!connector) throw new PairingError("connector_identity_invalid", 403);
  }

  return {
    type: "webmcp.connector_disconnection",
    protocol_version: "0.1",
    status: "disconnected",
    duplicate: revoked.count === 0,
  };
}

export async function hasEligibleConnectorToken(connectorToken: string): Promise<boolean> {
  const connector = await prisma.connector.findUnique({
    where: { tokenDigest: digest(connectorToken) },
    select: { expiresAt: true, revokedAt: true },
  });
  return Boolean(connector && connector.revokedAt === null && connector.expiresAt > new Date());
}
