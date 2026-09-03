import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { createApp } from "../../../app";
import { clearTestAccounts } from "../../../test/helper";

const app = createApp();
const email = `cloud-receiver-2-${Date.now()}@example.com`;
const dualSessionEmail = `cloud-receiver-2-logout-${Date.now()}@example.com`;
const sameOriginLogoutEmail = `cloud-receiver-2-logout-same-origin-${Date.now()}@example.com`;
const password = "correct horse battery staple";
const frontendOrigin = "http://localhost:3000";

describe("Cloud Receiver 2 authentication", () => {
  const userAgent = request.agent(app);
  const developerAgent = request.agent(app);

  beforeAll(async () => {
    await clearTestAccounts(email);
    await clearTestAccounts(dualSessionEmail);
    await clearTestAccounts(sameOriginLogoutEmail);
  });

  afterAll(async () => {
    await clearTestAccounts(email);
    await clearTestAccounts(dualSessionEmail);
    await clearTestAccounts(sameOriginLogoutEmail);
  });

  it("registers and authenticates a user", async () => {
    const register = await userAgent.post("/v1/auth/users/register").send({ email, password });

    expect(register.status).toBe(201);
    expect(register.body.data).toEqual({
      id: expect.any(String),
      email,
    });
    expect(register.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("user_session=")])
    );

    const me = await userAgent.get("/v1/auth/users/me");
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);
  });

  it("keeps developer authentication separate from user authentication", async () => {
    const register = await developerAgent
      .post("/v1/auth/developers/register")
      .send({ email, password });

    expect(register.status).toBe(201);
    expect(register.body.data).toEqual({
      id: expect.any(String),
      email,
    });
    expect(register.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("developer_session=")])
    );

    const me = await developerAgent.get("/v1/auth/developers/me");
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe(email);

    const wrongSurface = await developerAgent.get("/v1/auth/users/me");
    expect(wrongSurface.status).toBe(401);
  });

  it("rejects invalid credentials and malformed input", async () => {
    const invalidLogin = await request(app)
      .post("/v1/auth/users/login")
      .send({ email, password: "wrong password" });
    expect(invalidLogin.status).toBe(401);
    expect(invalidLogin.body.error).toBe("INVALID_CREDENTIALS");

    const invalidInput = await request(app)
      .post("/v1/auth/developers/login")
      .send({ email: "not-an-email", password: "short" });
    expect(invalidInput.status).toBe(400);
    expect(invalidInput.body.error).toBe("VALIDATION_ERROR");
  });

  it("rejects cross-origin logout while preserving both sessions", async () => {
    const agent = request.agent(app);

    const userRegister = await agent
      .post("/v1/auth/users/register")
      .send({ email: dualSessionEmail, password });
    expect(userRegister.status).toBe(201);

    const developerRegister = await agent
      .post("/v1/auth/developers/register")
      .send({ email: dualSessionEmail, password });
    expect(developerRegister.status).toBe(201);

    for (const path of ["/v1/auth/users/logout", "/v1/auth/developers/logout"]) {
      const response = await agent
        .post(path)
        .set("Origin", "https://attacker.example")
        .set("Content-Type", "application/json")
        .send({});

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: { code: "csrf_origin_invalid" } });
    }

    expect((await agent.get("/v1/auth/users/me")).status).toBe(200);
    expect((await agent.get("/v1/auth/developers/me")).status).toBe(200);
  });

  it("clears only the intended session on same-origin JSON logout and stays idempotent", async () => {
    const agent = request.agent(app);

    const userRegister = await agent
      .post("/v1/auth/users/register")
      .send({ email: sameOriginLogoutEmail, password });
    expect(userRegister.status).toBe(201);

    const developerRegister = await agent
      .post("/v1/auth/developers/register")
      .send({ email: sameOriginLogoutEmail, password });
    expect(developerRegister.status).toBe(201);

    const unsupportedContentType = await agent
      .post("/v1/auth/users/logout")
      .set("Origin", frontendOrigin)
      .set("Content-Type", "text/plain")
      .send("{}");
    expect(unsupportedContentType.status).toBe(415);
    expect(unsupportedContentType.body).toEqual({ error: { code: "http_content_type_invalid" } });
    expect((await agent.get("/v1/auth/users/me")).status).toBe(200);

    const userLogout = await agent
      .post("/v1/auth/users/logout")
      .set("Origin", frontendOrigin)
      .set("Content-Type", "application/json")
      .send({});
    expect(userLogout.status).toBe(200);
    expect(userLogout.body.success).toBe(true);
    expect(userLogout.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringContaining("user_session=")])
    );
    expect((await agent.get("/v1/auth/users/me")).status).toBe(401);
    expect((await agent.get("/v1/auth/developers/me")).status).toBe(200);

    const developerLogout = await agent
      .post("/v1/auth/developers/logout")
      .set("Origin", frontendOrigin)
      .set("Content-Type", "application/json")
      .send({});
    expect(developerLogout.status).toBe(200);
    expect((await agent.get("/v1/auth/developers/me")).status).toBe(401);

    const repeatedLogout = await agent
      .post("/v1/auth/users/logout")
      .set("Origin", frontendOrigin)
      .set("Content-Type", "application/json")
      .send({});
    expect(repeatedLogout.status).toBe(200);
  });
});
