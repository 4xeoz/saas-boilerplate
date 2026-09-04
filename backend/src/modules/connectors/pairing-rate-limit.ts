import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../db";
import { appConfig } from "../../config/config";
import { asyncHandler } from "../../lib/async-handler";
import { PairingError } from "./pairing.service";
import { fingerprintPairingSource, PairingSourceIdentityError } from "./pairing-source";

export const PAIRING_SOURCE_WINDOW_MS = 10 * 60 * 1_000;
export const PAIRING_SOURCE_MAX_REQUESTS = 30;

type RateBucketRow = {
  request_count: number;
  window_expires_at: Date;
};

function boundedRetryAfter(windowExpiresAt: Date, now: Date): number {
  const remainingMs = windowExpiresAt.getTime() - now.getTime();
  return Math.max(1, Math.min(Math.ceil(remainingMs / 1_000), PAIRING_SOURCE_WINDOW_MS / 1_000));
}

async function reserveSourceRequest(req: Request): Promise<number | undefined> {
  let sourceDigest: string;
  try {
    sourceDigest = fingerprintPairingSource(req.headers, appConfig.pairingSourceHmacSecret);
  } catch (error) {
    if (error instanceof PairingSourceIdentityError) {
      throw new PairingError("receiver_busy", 503, 1);
    }
    throw error;
  }

  const now = new Date();
  const windowStartedAt = new Date(
    Math.floor(now.getTime() / PAIRING_SOURCE_WINDOW_MS) * PAIRING_SOURCE_WINDOW_MS,
  );
  const windowExpiresAt = new Date(windowStartedAt.getTime() + PAIRING_SOURCE_WINDOW_MS);

  try {
    const rows = await prisma.$queryRaw<RateBucketRow[]>`
      INSERT INTO "cr2_pairing_claim_rate_buckets" (
        "source_digest",
        "window_started_at",
        "window_expires_at",
        "request_count",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${sourceDigest},
        ${windowStartedAt},
        ${windowExpiresAt},
        1,
        ${now},
        ${now}
      )
      ON CONFLICT ("source_digest", "window_started_at")
      DO UPDATE SET
        "request_count" = LEAST(
          "cr2_pairing_claim_rate_buckets"."request_count" + 1,
          ${PAIRING_SOURCE_MAX_REQUESTS + 1}
        ),
        "updated_at" = ${now}
      RETURNING "request_count", "window_expires_at"
    `;

    if (rows.length !== 1) throw new Error("pairing source bucket write returned no row");
    const requestCount = Number(rows[0].request_count);
    if (!Number.isSafeInteger(requestCount) || requestCount < 1) {
      throw new Error("pairing source bucket count is invalid");
    }
    if (requestCount <= PAIRING_SOURCE_MAX_REQUESTS) return undefined;

    const expiry = rows[0].window_expires_at instanceof Date
      ? rows[0].window_expires_at
      : new Date(String(rows[0].window_expires_at));
    if (!Number.isFinite(expiry.getTime())) throw new Error("pairing source bucket expiry is invalid");
    return boundedRetryAfter(expiry, now);
  } catch (error) {
    if (error instanceof PairingError) throw error;
    throw new PairingError("receiver_busy", 503, 1);
  }
}

function sendRateLimitError(res: Response, error: PairingError): void {
  if (error.retryAfterSeconds !== undefined) {
    res.set("Retry-After", String(error.retryAfterSeconds));
  }
  res.status(error.statusCode).json({ error: { code: error.code } });
}

/**
 * Reserve an anonymous claim request before body validation. This keeps
 * malformed and unknown-identifier probes inside the same source budget.
 */
export const pairingClaimRateLimit = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const retryAfter = await reserveSourceRequest(req);
      if (retryAfter !== undefined) {
        sendRateLimitError(res, new PairingError("pairing_rate_limited", 429, retryAfter));
        return;
      }
      next();
    } catch (error) {
      if (error instanceof PairingError) {
        sendRateLimitError(res, error);
        return;
      }
      next(error);
    }
  },
);
