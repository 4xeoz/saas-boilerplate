import { describe, expect, it } from "@jest/globals";
import {
  fingerprintPairingSource,
  PairingSourceIdentityError,
  readVercelClientIp,
} from "../pairing-source";

const secret = "pairing-source-test-secret-012345678901234567890123";

describe("pairing source adapter", () => {
  it("accepts one provider IP and fingerprints it without storing the raw value", () => {
    const headers = { "x-vercel-forwarded-for": "203.0.113.10" };

    expect(readVercelClientIp(headers)).toBe("203.0.113.10");
    const fingerprint = fingerprintPairingSource(headers, secret);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain("203.0.113.10");
    expect(fingerprint).not.toBe(fingerprintPairingSource(
      { "x-vercel-forwarded-for": "203.0.113.11" },
      secret,
    ));
  });

  it("rejects missing, repeated, invalid, and weak source identities", () => {
    const invalidHeaders = [
      {},
      { "x-vercel-forwarded-for": ["203.0.113.10"] },
      { "x-vercel-forwarded-for": "203.0.113.10, 203.0.113.11" },
      { "x-vercel-forwarded-for": "not-an-ip" },
    ];

    for (const headers of invalidHeaders) {
      expect(() => readVercelClientIp(headers)).toThrow(PairingSourceIdentityError);
      expect(() => fingerprintPairingSource(headers, secret)).toThrow(PairingSourceIdentityError);
    }
    expect(() => fingerprintPairingSource(
      { "x-vercel-forwarded-for": "203.0.113.10" },
      "too-short",
    )).toThrow(PairingSourceIdentityError);
  });

  it("changes the digest when the configured HMAC secret rotates", () => {
    const headers = { "x-vercel-forwarded-for": "203.0.113.10" };
    expect(fingerprintPairingSource(headers, secret)).not.toBe(
      fingerprintPairingSource(headers, `${secret}-rotated`),
    );
  });
});
