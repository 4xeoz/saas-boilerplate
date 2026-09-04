import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { createApp } from "../../../app";
import { prisma } from "../../../db";
import { clearTestAccounts } from "../../../test/helper";

const app = createApp();
const suffix = Date.now();
const userEmail = `pairing-abuse-user-${suffix}@example.com`;
const password = "correct horse battery staple";
const userAgent = request.agent(app);
const sourceSeed = 1 + (suffix % 200);

type Pairing = { pairingId: string; pairingCode: string };

function sourceAddress(lastOctet: number): string {
  return `198.51.100.${((sourceSeed + lastOctet) % 254) + 1}`;
}

async function createPairing(): Promise<Pairing> {
  const response = await userAgent
    .post("/v0.1/account/pairing-sessions")
    .set("Origin", "http://localhost:3000")
    .set("Content-Type", "application/json")
    .send({});

  expect(response.status).toBe(201);
  return {
    pairingId: String(response.body.pairing_id),
    pairingCode: String(response.body.pairing_code),
  };
}

function claim(
  body: Record<string, unknown>,
  source: string | undefined,
) {
  const requestBuilder = request(app)
    .post("/v0.1/account/pairing-sessions/claim")
    .set("Content-Type", "application/json");
  if (source !== undefined) requestBuilder.set("x-vercel-forwarded-for", source);
  return requestBuilder.send(body);
}

describe("Cloud Receiver v2 pairing abuse fence", () => {
  beforeAll(async () => {
    await clearTestAccounts(userEmail);
    const register = await userAgent
      .post("/v1/auth/users/register")
      .send({ email: userEmail, password });
    expect(register.status).toBe(201);
  });

  afterAll(async () => {
    await clearTestAccounts(userEmail);
  });

  it("requires pairing_id and rejects the old two-field body", async () => {
    const pairing = await createPairing();

    const oldBody = await claim({
      pairing_code: pairing.pairingCode,
      device_name: "Old Client",
    }, sourceAddress(11));
    expect(oldBody.status).toBe(400);
    expect(oldBody.body).toEqual({ error: { code: "http_body_invalid" } });

    const valid = await claim({
      pairing_id: pairing.pairingId,
      pairing_code: pairing.pairingCode,
      device_name: "New Client",
    }, sourceAddress(11));
    expect(valid.status).toBe(200);
    expect(valid.body.pairing_id).toBe(pairing.pairingId);
    expect(valid.body.duplicate).toBe(false);
  });

  it("counts five wrong codes and makes the sixth attempt terminal", async () => {
    const pairing = await createPairing();
    const source = sourceAddress(12);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await claim({
        pairing_id: pairing.pairingId,
        pairing_code: "00000000",
        device_name: "Guessing Client",
      }, source);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: { code: "pairing_not_found" } });
    }

    const terminal = await claim({
      pairing_id: pairing.pairingId,
      pairing_code: "00000000",
      device_name: "Guessing Client",
    }, source);
    expect(terminal.status).toBe(410);
    expect(terminal.body).toEqual({ error: { code: "pairing_expired" } });

    const row = await prisma.pairingSession.findUnique({
      where: { id: pairing.pairingId },
      select: { failedAttempts: true },
    });
    expect(row?.failedAttempts).toBe(6);

    const validAfterTerminal = await claim({
      pairing_id: pairing.pairingId,
      pairing_code: pairing.pairingCode,
      device_name: "Late Client",
    }, source);
    expect(validAfterTerminal.status).toBe(410);
  });

  it("allows a valid claim after five wrong codes before terminal transition", async () => {
    const pairing = await createPairing();
    const source = sourceAddress(13);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await claim({
        pairing_id: pairing.pairingId,
        pairing_code: "00000000",
        device_name: "Five Attempts Client",
      }, source);
      expect(response.status).toBe(404);
    }

    const valid = await claim({
      pairing_id: pairing.pairingId,
      pairing_code: pairing.pairingCode,
      device_name: "Five Attempts Client",
    }, source);
    expect(valid.status).toBe(200);
    expect(valid.body.duplicate).toBe(false);
  });

  it("keeps concurrent wrong claims atomic at the terminal boundary", async () => {
    const pairing = await createPairing();
    const source = sourceAddress(14);
    const wrongCode = pairing.pairingCode === "00000000" ? "FFFFFFFF" : "00000000";

    const responses = await Promise.all(
      Array.from({ length: 6 }, () => claim({
        pairing_id: pairing.pairingId,
        pairing_code: wrongCode,
        device_name: "Concurrent Guessing Client",
      }, source)),
    );

    expect(responses.filter((response) => response.status === 404)).toHaveLength(5);
    expect(responses.filter((response) => response.status === 410)).toHaveLength(1);
    const row = await prisma.pairingSession.findUnique({
      where: { id: pairing.pairingId },
      select: { failedAttempts: true },
    });
    expect(row?.failedAttempts).toBe(6);
  });

  it("returns a generic fail-closed response without a trusted source identity", async () => {
    const pairing = await createPairing();

    const missing = await claim({
      pairing_id: pairing.pairingId,
      pairing_code: pairing.pairingCode,
      device_name: "Missing Source Client",
    }, undefined);
    expect(missing.status).toBe(503);
    expect(missing.body).toEqual({ error: { code: "receiver_busy" } });

    const spoofed = await request(app)
      .post("/v0.1/account/pairing-sessions/claim")
      .set("Content-Type", "application/json")
      .set("x-forwarded-for", "203.0.113.9")
      .set("x-vercel-forwarded-for", "203.0.113.10, 203.0.113.11")
      .send({
        pairing_id: pairing.pairingId,
        pairing_code: pairing.pairingCode,
        device_name: "Spoofed Source Client",
      });
    expect(spoofed.status).toBe(503);

    const invalid = await claim({
      pairing_id: pairing.pairingId,
      pairing_code: pairing.pairingCode,
      device_name: "Invalid Source Client",
    }, "not-an-ip");
    expect(invalid.status).toBe(503);
  });

  it("fails closed when the durable source limiter store is unavailable", async () => {
    const pairing = await createPairing();
    const queryRaw = jest
      .spyOn(prisma, "$queryRaw")
      .mockRejectedValueOnce(new Error("limiter store outage marker"));

    try {
      const response = await claim({
        pairing_id: pairing.pairingId,
        pairing_code: pairing.pairingCode,
        device_name: "Limiter Outage Client",
      }, sourceAddress(16));

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ error: { code: "receiver_busy" } });
    } finally {
      queryRaw.mockRestore();
    }
  });

  it("caps one source at thirty requests per ten-minute window", async () => {
    const source = sourceAddress(15);
    const responses = [];
    for (let index = 0; index < 31; index += 1) {
      responses.push(await claim({
        pairing_id: `unknown_pairing_${index}`,
        pairing_code: "00000000",
        device_name: "Rate Client",
      }, source));
    }

    expect(responses.slice(0, 30).every((response) => response.status === 404)).toBe(true);
    expect(responses[30].status).toBe(429);
    expect(responses[30].body).toEqual({ error: { code: "pairing_rate_limited" } });
    expect(responses[30].headers["retry-after"]).toMatch(/^[1-9][0-9]{0,2}$/);
  });
});
