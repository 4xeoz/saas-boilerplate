import crypto from "crypto";

/** A random secret to hand out. Only its hash is ever stored. */
export function generateToken(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(32).toString("hex")}`;
}

/**
 * SHA-256, hex. Fast on purpose: these are 32 bytes of entropy, not
 * passwords, so there is nothing to brute-force and no need for bcrypt.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
