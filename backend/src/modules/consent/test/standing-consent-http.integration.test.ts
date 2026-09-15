import { generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { runInNewContext } from "node:vm";
import { beforeAll, describe, expect, it } from "@jest/globals";
import request from "supertest";
import { createApp } from "../../../app";
import { appConfig } from "../../../config/config";
import { prisma } from "../../../db";
import { digestSecret } from "../../../middleware/organization-auth";
import { canonicalJson } from "../manifest";
import { createStandingReentryManifest } from "../../standing/standing.protocol";

const { verifyOwnedDatabase } = require("../../../../conformance/standing-v0.2/disposable-database.cjs");
const app = createApp();
const owner = request.agent(app);
const other = request.agent(app);
const empty = request.agent(app);
const suffix = randomUUID();
// Isolate durable pairing budgets from other suites and repeat runs.
const pairingSource = `2001:db8:${randomBytes(12).toString("hex").match(/.{4}/g)!.join(":")}`;
const origin = `https://consent-integration-${suffix}.example`;
const keys = generateKeyPairSync("ed25519");
const keyId = `key-${suffix}`;
const password = randomBytes(24).toString("base64url");
let accountId: string;
let organizationId: string;
let apiKey: string;
let connectorId: string;
let foreignId: string;
let expiredId: string;
let revokedId: string;

async function pair(agent: typeof owner, name: string): Promise<string> {
  const pairing = await agent.post("/v0.1/account/pairing-sessions")
    .set("Origin", appConfig.frontendUrl).send({});
  expect(pairing.status).toBe(201);
  const claim = await request(app).post("/v0.1/account/pairing-sessions/claim")
    .set("x-vercel-forwarded-for", pairingSource)
    .send({ pairing_id: pairing.body.pairing_id, pairing_code: pairing.body.pairing_code, device_name: name });
  expect(claim.status).toBe(200);
  return claim.body.connector_id;
}

beforeAll(async () => {
  const verified = await verifyOwnedDatabase(process.env);
  expect(appConfig.databaseUrl).toBe(verified.databaseUrl);
  for (const [agent, label] of [[owner, "owner"], [other, "other"], [empty, "empty"]] as const) {
    const email = `standing-page-${label}-${suffix}@example.invalid`;
    const registered = await agent.post("/v1/auth/users/register").send({ email, password });
    expect(registered.status).toBe(201);
    if (label === "owner") accountId = registered.body.data.id;
    const loggedIn = await agent.post("/v1/auth/users/login").send({ email, password });
    expect(loggedIn.status).toBe(200);
    expect(loggedIn.headers["set-cookie"]).toBeDefined();
  }
  const developer = await request(app).post("/v1/auth/developers/register")
    .send({ email: `standing-page-dev-${suffix}@example.invalid`, password });
  expect(developer.status).toBe(201);
  organizationId = (await prisma.organization.create({
    data: { developerId: developer.body.data.id, name: `Page integration ${suffix}` },
  })).id;
  apiKey = randomBytes(32).toString("base64url");
  await prisma.organizationApiKey.create({ data: {
    organizationId, keyDigest: digestSecret(apiKey), keyPrefix: apiKey.slice(0, 8),
  } });
  const enrolled = await request(app).post("/v0.2/host-keys").set("Authorization", `Bearer ${apiKey}`)
    .send({ host_id: `host-${suffix}`, issuer_origin: origin, key_id: keyId,
      public_key_pem: keys.publicKey.export({ type: "spki", format: "pem" }).toString() });
  expect(enrolled.status).toBe(201);
  connectorId = await pair(owner, "Owned <safe> Mac");
  foreignId = await pair(other, "Other account Mac");
  expiredId = await pair(owner, "Expired Mac");
  revokedId = await pair(owner, "Revoked Mac");
  // Only this suite's new rows are changed, to exercise persisted eligibility checks.
  await prisma.connector.update({ where: { id: expiredId }, data: {
    createdAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() - 60_000),
  } });
  await prisma.connector.update({ where: { id: revokedId }, data: { revokedAt: new Date() } });
  // No cleanup: retain the suite's UUID-namespaced fixtures in the owned disposable cluster.
});

async function enroll(version: "0.1" | "0.2" = "0.2") {
  const id = `manifest-${randomUUID()}`;
  const now = Date.now();
  const common = {
    type: "webmcp.reentry_manifest" as const, manifest_id: id, correlation_id: `correlation-${id}`,
    issuer_origin: origin, issued_at: new Date(now - 1000).toISOString(),
    offer_expires_at: new Date(now + 300_000).toISOString(),
    workflow: { id: `workflow-${id}`, type: "review", state_version: 1, canonical_url: `${origin}/work/${id}` },
    display: { title: `Review <safe> ${id}`, reason: "Read current state & stop at human review." },
  };
  const scope = { event_type: "workflow.ready", grant_expires_at: new Date(now + 3600_000).toISOString(),
    human_boundary: "confirm_irreversible_action" };
  let manifest: unknown;
  if (version === "0.2") {
    manifest = createStandingReentryManifest({ ...common, protocol_version: "0.2",
      grant_request: { ...scope, authorization_mode: "standing", max_active_activations: 1 } },
    { privateKey: keys.privateKey, keyId });
  } else {
    const unsigned = { ...common, protocol_version: "0.1", grant_request: { ...scope, max_runs: 1 } };
    manifest = { ...unsigned, signature: { algorithm: "Ed25519", key_id: keyId,
      value: sign(null, Buffer.from(canonicalJson(unsigned)), keys.privateKey).toString("base64url") } };
  }
  const response = await request(app).post(`/v${version}/consent-sessions`)
    .set("Authorization", `Bearer ${apiKey}`).send({ host_subject_ref: `subject-${id}`, expected_origin: origin,
      manifest, ...(version === "0.2" ? { maximum_grant_lifetime_ms: 3600_000 } : {}) });
  expect(response.status).toBe(201);
  const token = new URL(response.body.consent_url).searchParams.get("token")!;
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  return { token, id: response.body.consent_session_id as string, page: `/consent?token=${token}`, manifestId: id };
}
type Enrollment = Awaited<ReturnType<typeof enroll>>;
function decision(f: Enrollment, action: "approve" | "decline" = "approve", selected = connectorId) {
  return { consent_token: f.token, action, decision_id: `decision-${randomUUID()}`,
    decided_at: new Date().toISOString(), ...(action === "approve" ? { connector_id: selected } : {}) };
}
function sendDecision(agent: typeof owner, body: ReturnType<typeof decision>) {
  return agent.post("/v0.2/account-consent-decisions").set("Origin", appConfig.receiverPublicUrl).send(body);
}
async function persisted(f: Enrollment) {
  return prisma.standingConsentSession.findUniqueOrThrow({ where: { id: f.id }, include: { grant: true } });
}

describe("real shared Consent HTTP and standing persistence", () => {
  it.each(["0.1", "0.2"] as const)("dispatches %s tokens and preserves login continuation without creating authority", async version => {
    const f = await enroll(version);
    const anonymous = await request(app).get(f.page);
    expect(anonymous.status).toBe(302);
    const login = new URL(anonymous.headers.location);
    expect(login.origin).toBe(new URL(appConfig.frontendUrl).origin);
    expect(login.pathname).toBe("/user-login");
    expect(login.searchParams.get("return_to")).toBe(f.page);
    const page = await owner.get(f.page);
    expect(page.status).toBe(200);
    expect(page.headers["cache-control"]).toBe("no-store");
    expect(page.headers["cross-origin-opener-policy"]).toBe("unsafe-none");
    expect(page.text).toContain(`/v${version}/account-consent-decisions`);
    expect(page.text).toContain("Review &lt;safe&gt;");
    expect(page.text).not.toContain(f.token);
    if (version === "0.2") {
      const stored = await persisted(f);
      expect(stored).toMatchObject({ status: "pending", accountId: null, grant: null, tokenDigest: digestSecret(f.token) });
      expect(await prisma.consentSession.count({ where: { tokenDigest: digestSecret(f.token) } })).toBe(0);
    } else {
      expect(await prisma.consentSession.count({ where: { tokenDigest: digestSecret(f.token) } })).toBe(1);
      expect(await prisma.standingConsentSession.count({ where: { tokenDigest: digestSecret(f.token) } })).toBe(0);
    }
  });

  it("projects only eligible account-owned Connectors and disables approval for an empty account", async () => {
    const f = await enroll(); const page = await owner.get(f.page);
    expect(page.status).toBe(200);
    expect(page.text).toContain(`value="${connectorId}"`);
    expect(page.text).toContain("Owned &lt;safe&gt; Mac");
    for (const id of [foreignId, expiredId, revokedId]) expect(page.text).not.toContain(id);
    const unavailable = await empty.get(f.page);
    expect(unavailable.status).toBe(200);
    expect(unavailable.text).toContain("No connected Mac is ready");
    expect(unavailable.text).toMatch(/id="approve"[^>]*disabled/);
    expect((await persisted(f)).grant).toBeNull();
  });

  it.each(["anonymous", "missing-origin", "foreign-origin"])("rejects %s decisions without persistence", async kind => {
    const f = await enroll(); const body = decision(f); const before = await persisted(f);
    const req = (kind === "anonymous" ? request(app) : owner).post("/v0.2/account-consent-decisions");
    if (kind !== "missing-origin") req.set("Origin", kind === "foreign-origin" ? origin : appConfig.receiverPublicUrl);
    const response = await req.send(body);
    expect(response.status).toBe(kind === "anonymous" ? 401 : 403);
    expect(await persisted(f)).toEqual(before);
  });

  it.each(["foreign", "expired", "revoked"])("rejects a %s Connector without granting authority", async kind => {
    const f = await enroll(); const before = await persisted(f);
    const response = await sendDecision(owner, decision(f, "approve", { foreign: foreignId, expired: expiredId, revoked: revokedId }[kind]!));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("connector_not_available");
    expect(await persisted(f)).toEqual(before);
  });

  it("persists approval once and fences conflicting or other-account replay", async () => {
    const f = await enroll(); const body = decision(f);
    const approved = await sendDecision(owner, body);
    expect(approved.status).toBe(200);
    expect(approved.headers["cache-control"]).toBe("no-store");
    const stored = await persisted(f);
    expect(stored).toMatchObject({ status: "approved", accountId, decisionId: body.decision_id,
      grant: { accountId, connectorId } });
    const replay = await sendDecision(owner, body);
    expect(replay.status).toBe(200); expect(replay.body.duplicate).toBe(true);
    expect((await sendDecision(other, body)).status).toBe(409);
    expect((await sendDecision(owner, decision(f, "decline"))).status).toBe(409);
    expect(await persisted(f)).toEqual(stored);
    const page = await owner.get(f.page);
    expect(page.status).toBe(200); expect(page.text).toContain("This request was approved");
    expect(page.text).not.toContain('id="approve"'); expect(page.text).not.toContain(f.token);
  });

  it("persists decline without a Grant and renders the terminal page", async () => {
    const f = await enroll(); const response = await sendDecision(owner, decision(f, "decline"));
    expect(response.status).toBe(200);
    expect(await persisted(f)).toMatchObject({ status: "declined", accountId, grant: null });
    const page = await owner.get(f.page);
    expect(page.status).toBe(200); expect(page.text).toContain("This request was declined");
    expect(page.text).not.toContain('id="decline"'); expect(page.text).not.toContain(f.token);
  });

  it("rejects an expired pending token from persisted state and an unknown token", async () => {
    const f = await enroll();
    await prisma.standingConsentSession.update({ where: { id: f.id }, data: {
      createdAt: new Date(Date.now() - 120_000), expiresAt: new Date(Date.now() - 60_000),
    } });
    const before = await persisted(f);
    const page = await owner.get(f.page);
    expect(page.status).toBe(410); expect(page.body.error.code).toBe("consent_session_expired");
    expect(page.text).not.toContain(f.token);
    expect((await sendDecision(owner, decision(f))).body.error.code).toBe("consent_decision_expired");
    expect(await persisted(f)).toEqual(before);
    const missing = await owner.get(`/consent?token=${randomBytes(32).toString("base64url")}`);
    expect(missing.status).toBe(404); expect(missing.body.error.code).toBe("consent_token_invalid");
  });

  it("executes the served popup script through real decision HTTP and sends only the matching public completion", async () => {
    const f = await enroll(); const page = await owner.get(f.page); expect(page.status).toBe(200);
    const script = page.text.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1]; expect(script).toBeDefined();
    const clicks = new Map<string, () => void>();
    let resolveMessage!: (value: { message: unknown; target: string }) => void;
    const completed = new Promise<{ message: unknown; target: string }>(resolve => { resolveMessage = resolve; });
    const elements: Record<string, unknown> = { "#result": { textContent: "" }, ".card": { classList: { add() {} } },
      'input[name="connector"]': { value: connectorId }, 'input[name="connector"]:checked': { value: connectorId } };
    for (const selector of ["#approve", "#decline", "#refresh"]) elements[selector] = {
      disabled: false, remove() {}, addEventListener(_name: string, cb: () => void) { clicks.set(selector, cb); },
    };
    // Only DOM/window are simulated. Fetch exercises the authenticated Express route and PostgreSQL.
    runInNewContext(script!, { URLSearchParams, Date, crypto: { randomUUID },
      document: { querySelector: (selector: string) => elements[selector] },
      window: { location: { search: `?token=${f.token}`, reload() {} },
        opener: { postMessage: (message: unknown, target: string) => resolveMessage({ message, target }) } },
      fetch: async (url: string, options: { method: string; credentials: string; body: string }) => {
        expect(url).toBe("/v0.2/account-consent-decisions"); expect(options.credentials).toBe("same-origin");
        const response = await sendDecision(owner, JSON.parse(options.body));
        return { ok: response.status === 200, json: async () => response.body };
      },
    });
    clicks.get("#approve")!();
    const result = await completed;
    expect(result).toEqual({ target: origin, message: {
      type: "reentry.consent.complete", consent_session_id: f.id, status: "approved",
    } });
    expect(JSON.stringify(result)).not.toContain(f.token);
    expect(await persisted(f)).toMatchObject({ status: "approved", accountId, grant: { connectorId } });
  });
});
