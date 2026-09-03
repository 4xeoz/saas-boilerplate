import { describe, expect, it, jest } from "@jest/globals";
import { once } from "node:events";
import { request as nodeRequest } from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { createApp } from "../../../app";
import * as standingService from "../standing.service";

async function rawRequest(input: {
  path: string;
  method?: string;
  body: Buffer;
  headers?: Record<string, string | string[]>;
}): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; text: string }> {
  const server = createApp().listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  try {
    return await new Promise((resolve, reject) => {
      const outgoing = nodeRequest(
        {
          host: "127.0.0.1",
          port: address.port,
          method: input.method ?? "POST",
          path: input.path,
          headers: {
            "Content-Length": String(input.body.length),
            ...input.headers,
          },
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
          response.on("end", () => {
            resolve({
              status: response.statusCode ?? 0,
              headers: response.headers,
              text: Buffer.concat(chunks).toString("utf8"),
            });
          });
        }
      );
      outgoing.on("error", reject);
      outgoing.end(input.body);
    });
  } finally {
    server.close();
    await once(server, "close");
  }
}

describe("standing authorization v0.2 transport", () => {
  it.each(["POST", "OPTIONS"])(
    "rejects absolute-form standing aliases before parsing or CORS: %s",
    async (method) => {
      for (const path of [
        "http://receiver.test/v0.2/events",
        "http://receiver.test/v0.2/events?ignored=1",
        "https://receiver.test/v0.2/delivery-claims",
        "http://receiver.test/v0.2/delivery-acknowledgements",
        "http://receiver.test/V0.2/events",
        "http://receiver.test/v0.2/events/",
      ]) {
        const response = await rawRequest({
          path,
          method,
          body: Buffer.from("{"),
          headers: {
            "Content-Type": "application/json",
            Origin: "https://example.test",
            "Access-Control-Request-Method": "POST",
          },
        });
        expect({ path, status: response.status }).toEqual({ path, status: 404 });
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(response.headers.pragma).toBe("no-cache");
        expect(response.text).toBe(
          '{"error":{"code":"http_route_not_found","retryable":false}}'
        );
      }
    }
  );

  it("preserves the Receiver's typed Event-envelope validation", async () => {
    const response = await request(createApp())
      .post("/v0.2/events")
      .set("Content-Type", "application/json")
      .send({});

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      error: {
        code: "receiver_input_fields_invalid",
        retryable: false,
      },
    });
  });

  it.each([
    ["query-bearing route", "/v0.2/events?unexpected=1"],
    ["case-variant route", "/V0.2/events"],
    ["unknown route", "/v0.2/unknown"],
  ])("rejects an exact-route mismatch before body parsing: %s", async (_label, path) => {
    const response = await request(createApp())
      .post(path)
      .set("Content-Type", "application/json")
      .send("{");

    expect(response.status).toBe(404);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.body).toEqual({
      error: {
        code: "http_route_not_found",
        retryable: false,
      },
    });
  });

  it("rejects CORS preflight as an unsupported protocol method", async () => {
    const response = await request(createApp())
      .options("/v0.2/events")
      .set("Origin", "https://example.test")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe("POST");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers.pragma).toBe("no-cache");
    expect(response.body).toEqual({
      error: {
        code: "http_method_not_allowed",
        retryable: false,
      },
    });
  });

  it("rejects duplicate Content-Type fields before parsing or service dispatch", async () => {
    const body = Buffer.from(JSON.stringify({
      connector_token: "connector_secret",
      claim_token: "A".repeat(43),
    }));
    const response = await rawRequest({
      path: "/v0.2/delivery-claims",
      body,
      headers: { "Content-Type": ["application/json", "application/json"] },
    });

    expect(response.status).toBe(415);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).toBe(
      '{"error":{"code":"http_content_type_invalid","retryable":false}}'
    );
  });

  it("rejects invalid UTF-8 instead of decoding replacement characters", async () => {
    const body = Buffer.concat([
      Buffer.from('{"body":"'),
      Buffer.from([0xff]),
      Buffer.from('","headers":{}}'),
    ]);
    const response = await rawRequest({
      path: "/v0.2/events",
      body,
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status).toBe(400);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.text).toBe(
      '{"error":{"code":"http_body_invalid","retryable":false}}'
    );
  });

  it.each([
    [
      "empty body",
      "",
      400,
      "http_body_invalid",
      { "Content-Type": "application/json" },
    ],
    ["array body", "[]", 400, "http_body_invalid", { "Content-Type": "application/json" }],
    [
      "unsupported charset",
      "{}",
      415,
      "http_content_type_invalid",
      { "Content-Type": "application/json; charset=latin1" },
    ],
    [
      "identity content encoding",
      "{}",
      415,
      "http_content_type_invalid",
      { "Content-Type": "application/json", "Content-Encoding": "identity" },
    ],
  ])("rejects malformed transport input: %s", async (_label, body, status, code, headers) => {
    const response = await rawRequest({
      path: "/v0.2/events",
      body: Buffer.from(body),
      headers: {
        ...(body.length > 0 ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
    });

    expect(response.status).toBe(status);
    expect(response.text).toBe(
      JSON.stringify({ error: { code, retryable: false } })
    );
  });

  it("separates HTTP field-shape errors from Receiver token validation", async () => {
    const invalidShape = await request(createApp())
      .post("/v0.2/delivery-claims")
      .set("Content-Type", "application/json")
      .send({
        connector_token: "connector_secret",
        claim_token: "A".repeat(43),
        unexpected: true,
      });
    expect(invalidShape.status).toBe(400);
    expect(invalidShape.body).toEqual({
      error: { code: "http_body_invalid", retryable: false },
    });

    const invalidValue = await request(createApp())
      .post("/v0.2/delivery-claims")
      .set("Content-Type", "application/json")
      .send({ connector_token: "connector_secret", claim_token: 7 });
    expect(invalidValue.status).toBe(403);
    expect(invalidValue.body).toEqual({
      error: { code: "delivery_claim_token_invalid", retryable: false },
    });
  });

  it("rejects a body larger than the standing request limit", async () => {
    const response = await request(createApp())
      .post("/v0.2/events")
      .set("Content-Type", "application/json")
      .send({ value: "x".repeat(16 * 1_024) });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({
      error: { code: "http_body_too_large", retryable: false },
    });
  });

  it("redacts an unknown failure even when it carries HTTP-like status metadata", async () => {
    const privateError = Object.assign(new Error("private bearer and database path"), {
      status: 400,
      statusCode: 400,
    });
    const service = jest
      .spyOn(standingService, "acceptStandingEvent")
      .mockRejectedValueOnce(privateError);
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await request(createApp())
        .post("/v0.2/events")
        .set("Content-Type", "application/json")
        .send({ body: "{}", headers: {} });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { code: "receiver_internal_error", retryable: false },
      });
      expect(response.text).not.toContain("private bearer");
      expect(JSON.stringify(log.mock.calls)).not.toContain("private bearer");
    } finally {
      service.mockRestore();
      log.mockRestore();
    }
  });

  it.each(["P2024", "P2034"])(
    "maps bounded database contention %s without exposing details",
    async (databaseCode) => {
      const service = jest
        .spyOn(standingService, "acceptStandingEvent")
        .mockRejectedValueOnce(
          Object.assign(new Error("private database detail"), { code: databaseCode })
        );
      try {
        const response = await request(createApp())
          .post("/v0.2/events")
          .set("Content-Type", "application/json")
          .send({ body: "{}", headers: {} });

        expect(response.status).toBe(503);
        expect(response.headers["retry-after"]).toBe("1");
        expect(response.body).toEqual({
          error: { code: "receiver_busy", retryable: true },
        });
        expect(response.text).not.toContain("private database detail");
      } finally {
        service.mockRestore();
      }
    }
  );
});
