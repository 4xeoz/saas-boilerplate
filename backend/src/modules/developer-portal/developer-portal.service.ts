import { randomBytes } from "node:crypto";
import type { Organization, OrganizationApiKey, Prisma } from "@prisma/client";
import { prisma } from "../../db";
import { digestSecret } from "../../middleware/organization-auth";
import { deriveEffectiveGrantStatus, type EffectiveGrantStatus } from "../consent/grant-control";
import type { CreateOrganization } from "./developer-portal.schemas";

const EVENT_HISTORY_LIMIT = 100;

export class DeveloperPortalError extends Error {
  constructor(
    public readonly code: "ORGANIZATION_NOT_FOUND" | "API_KEY_NOT_FOUND",
    public readonly statusCode: 404
  ) {
    super(code);
    this.name = "DeveloperPortalError";
  }
}

export type OrganizationSummary = {
  organization_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type ApiKeySummary = {
  api_key_id: string;
  key_prefix: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type ApiKeyReveal = ApiKeySummary & {
  api_key: string;
};

export type DeveloperEventSummary = {
  event_id: string;
  event_type: string;
  issuer_origin: string;
  workflow_id: string;
  received_at: string;
  delivery_state: string | null;
  delivery_attempt: number | null;
  acknowledged_at: string | null;
  terminal_reason: string | null;
};

export type DeveloperConsentSummary = {
  consent_session_id: string;
  site_origin: string;
  site_name: string;
  title: string | null;
  reason: string | null;
  workflow_id: string | null;
  event_type: string | null;
  status: string;
  grant_status: EffectiveGrantStatus | null;
  created_at: string;
  approved_at: string | null;
  expires_at: string;
  runs_remaining: number | null;
};

function organizationSummary(organization: Pick<Organization, "id" | "name" | "createdAt" | "updatedAt">): OrganizationSummary {
  return {
    organization_id: organization.id,
    name: organization.name,
    created_at: organization.createdAt.toISOString(),
    updated_at: organization.updatedAt.toISOString(),
  };
}

function apiKeySummary(apiKey: Pick<OrganizationApiKey, "id" | "keyPrefix" | "createdAt" | "expiresAt" | "revokedAt">): ApiKeySummary {
  return {
    api_key_id: apiKey.id,
    key_prefix: apiKey.keyPrefix,
    created_at: apiKey.createdAt.toISOString(),
    expires_at: apiKey.expiresAt?.toISOString() ?? null,
    revoked_at: apiKey.revokedAt?.toISOString() ?? null,
  };
}

function revealedApiKey(apiKey: OrganizationApiKey, rawKey: string): ApiKeyReveal {
  return {
    ...apiKeySummary(apiKey),
    api_key: rawKey,
  };
}

function newApiKey(): { rawKey: string; keyDigest: string; keyPrefix: string } {
  const rawKey = randomBytes(32).toString("base64url");
  return {
    rawKey,
    keyDigest: digestSecret(rawKey),
    keyPrefix: rawKey.slice(0, 8),
  };
}

async function requireOwnedOrganization(
  developerId: string,
  organizationId: string,
  transaction: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Organization> {
  const organization = await transaction.organization.findFirst({
    where: { id: organizationId, developerId },
  });
  if (!organization) throw new DeveloperPortalError("ORGANIZATION_NOT_FOUND", 404);
  return organization;
}

export async function listOrganizations(developerId: string): Promise<{ organizations: OrganizationSummary[] }> {
  const organizations = await prisma.organization.findMany({
    where: { developerId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return { organizations: organizations.map(organizationSummary) };
}

export async function createOrganization(
  developerId: string,
  input: CreateOrganization
): Promise<{ organization: OrganizationSummary; api_key: ApiKeyReveal }> {
  const generated = newApiKey();
  const result = await prisma.$transaction(async (transaction) => {
    const organization = await transaction.organization.create({
      data: { developerId, name: input.name },
    });
    const apiKey = await transaction.organizationApiKey.create({
      data: {
        organizationId: organization.id,
        keyDigest: generated.keyDigest,
        keyPrefix: generated.keyPrefix,
      },
    });
    return { organization, apiKey };
  });

  return {
    organization: organizationSummary(result.organization),
    api_key: revealedApiKey(result.apiKey, generated.rawKey),
  };
}

export async function listApiKeys(
  developerId: string,
  organizationId: string
): Promise<{ api_keys: ApiKeySummary[] }> {
  await requireOwnedOrganization(developerId, organizationId);
  const apiKeys = await prisma.organizationApiKey.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return { api_keys: apiKeys.map(apiKeySummary) };
}

export async function createApiKey(
  developerId: string,
  organizationId: string
): Promise<{ api_key: ApiKeyReveal }> {
  const generated = newApiKey();
  const apiKey = await prisma.$transaction(async (transaction) => {
    await requireOwnedOrganization(developerId, organizationId, transaction);
    return transaction.organizationApiKey.create({
      data: {
        organizationId,
        keyDigest: generated.keyDigest,
        keyPrefix: generated.keyPrefix,
      },
    });
  });
  return { api_key: revealedApiKey(apiKey, generated.rawKey) };
}

export async function revokeApiKey(
  developerId: string,
  organizationId: string,
  apiKeyId: string
): Promise<{ api_key: ApiKeySummary; duplicate: boolean }> {
  return prisma.$transaction(async (transaction) => {
    await requireOwnedOrganization(developerId, organizationId, transaction);
    const apiKey = await transaction.organizationApiKey.findFirst({
      where: { id: apiKeyId, organizationId },
    });
    if (!apiKey) throw new DeveloperPortalError("API_KEY_NOT_FOUND", 404);

    if (apiKey.revokedAt !== null) {
      return { api_key: apiKeySummary(apiKey), duplicate: true };
    }

    const revokedAt = new Date();
    const updated = await transaction.organizationApiKey.updateMany({
      where: { id: apiKey.id, organizationId, revokedAt: null },
      data: { revokedAt },
    });
    if (updated.count === 1) {
      return {
        api_key: apiKeySummary({ ...apiKey, revokedAt }),
        duplicate: false,
      };
    }

    const current = await transaction.organizationApiKey.findFirst({
      where: { id: apiKey.id, organizationId },
    });
    if (!current) throw new DeveloperPortalError("API_KEY_NOT_FOUND", 404);
    return { api_key: apiKeySummary(current), duplicate: true };
  });
}

const eventHistorySelect = {
  eventId: true,
  eventType: true,
  issuerOrigin: true,
  workflowId: true,
  receivedAt: true,
  delivery: {
    select: {
      status: true,
      currentAttempt: true,
      acknowledgedAt: true,
      terminalReason: true,
    },
  },
} as const;

type EventHistoryRecord = Prisma.EventGetPayload<{ select: typeof eventHistorySelect }>;

const consentHistorySelect = {
  id: true,
  status: true,
  decisionAt: true,
  expiresAt: true,
  createdAt: true,
  manifestJson: true,
  grant: {
    select: {
      issuerOrigin: true,
      workflowId: true,
      eventType: true,
      humanBoundary: true,
      runsRemaining: true,
      expiresAt: true,
      revokedAt: true,
    },
  },
} as const;

type ConsentHistoryRecord = Prisma.ConsentSessionGetPayload<{ select: typeof consentHistorySelect }>;

function jsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nestedRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function siteName(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function consentDisplayFields(manifestJson: Prisma.JsonValue): {
  siteOrigin: string | null;
  title: string | null;
  reason: string | null;
  workflowId: string | null;
  eventType: string | null;
} {
  const manifest = jsonRecord(manifestJson);
  const display = nestedRecord(manifest?.display);
  const workflow = nestedRecord(manifest?.workflow);
  const grantRequest = nestedRecord(manifest?.grant_request);
  return {
    siteOrigin: textValue(manifest?.issuer_origin),
    title: textValue(display?.title),
    reason: textValue(display?.reason),
    workflowId: textValue(workflow?.id),
    eventType: textValue(grantRequest?.event_type),
  };
}

export async function listConsentHistory(
  developerId: string,
  organizationId: string
): Promise<{ consents: DeveloperConsentSummary[] }> {
  await requireOwnedOrganization(developerId, organizationId);
  const sessions = await prisma.consentSession.findMany({
    where: { organizationId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: EVENT_HISTORY_LIMIT,
    select: consentHistorySelect,
  });
  const now = new Date();

  return {
    consents: sessions.map((session: ConsentHistoryRecord) => {
      const display = consentDisplayFields(session.manifestJson);
      const grant = session.grant;
      const status = session.status === "pending" && session.expiresAt <= now
        ? "expired"
        : session.status;
      const siteOrigin = grant?.issuerOrigin ?? display.siteOrigin ?? "Unknown origin";
      return {
        consent_session_id: session.id,
        site_origin: siteOrigin,
        site_name: siteName(siteOrigin),
        title: display.title,
        reason: display.reason,
        workflow_id: grant?.workflowId ?? display.workflowId,
        event_type: grant?.eventType ?? display.eventType,
        status,
        grant_status: grant ? deriveEffectiveGrantStatus(grant, now) : null,
        created_at: session.createdAt.toISOString(),
        approved_at: session.decisionAt?.toISOString() ?? null,
        expires_at: session.expiresAt.toISOString(),
        runs_remaining: grant?.runsRemaining ?? null,
      };
    }),
  };
}

export async function listEventHistory(
  developerId: string,
  organizationId: string
): Promise<{ events: DeveloperEventSummary[] }> {
  await requireOwnedOrganization(developerId, organizationId);
  const events = await prisma.event.findMany({
    where: { grant: { is: { organizationId } } },
    orderBy: [{ receivedAt: "desc" }, { eventId: "desc" }],
    take: EVENT_HISTORY_LIMIT,
    select: eventHistorySelect,
  });

  return {
    events: events.map((event: EventHistoryRecord) => ({
      event_id: event.eventId,
      event_type: event.eventType,
      issuer_origin: event.issuerOrigin,
      workflow_id: event.workflowId,
      received_at: event.receivedAt.toISOString(),
      delivery_state: event.delivery?.status ?? null,
      delivery_attempt: event.delivery?.currentAttempt ?? null,
      acknowledged_at: event.delivery?.acknowledgedAt?.toISOString() ?? null,
      terminal_reason: event.delivery?.terminalReason ?? null,
    })),
  };
}
