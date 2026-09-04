import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import type { IncomingHttpHeaders } from "node:http";

export const PAIRING_SOURCE_HEADER = "x-vercel-forwarded-for";

export class PairingSourceIdentityError extends Error {
  constructor() {
    super("trusted pairing source identity is unavailable");
    this.name = "PairingSourceIdentityError";
  }
}

/**
 * Read the client identity supplied by the direct Vercel deployment.
 *
 * A repeated or comma-separated header is rejected rather than selecting one
 * value from an ambiguous proxy chain. Express's derived req.ip and the
 * arbitrary X-Forwarded-For header are deliberately outside this boundary.
 */
export function readVercelClientIp(headers: IncomingHttpHeaders): string {
  const value = headers[PAIRING_SOURCE_HEADER];
  if (typeof value !== "string" || value.trim().length === 0 || value.includes(",")) {
    throw new PairingSourceIdentityError();
  }

  const clientIp = value.trim();
  if (isIP(clientIp) === 0) throw new PairingSourceIdentityError();
  return clientIp;
}

export function fingerprintPairingSource(
  headers: IncomingHttpHeaders,
  secret: string,
): string {
  if (typeof secret !== "string" || secret.length < 32) {
    throw new PairingSourceIdentityError();
  }
  const clientIp = readVercelClientIp(headers);
  return createHmac("sha256", secret)
    .update(`reentry-pairing-source:v1:${clientIp}`, "utf8")
    .digest("hex");
}
