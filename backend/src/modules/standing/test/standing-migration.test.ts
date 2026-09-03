import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import { Client } from "pg";
import { seedV01UpgradeSentinel } from "./standing-migration-sentinel";

const TABLES = [
  "cr2_standing_consent_sessions",
  "cr2_standing_grants",
  "cr2_standing_events",
  "cr2_standing_deliveries",
  "cr2_standing_delivery_attempts",
] as const;
const SENTINEL = "standing-migration-v01";
const CREATED_AT = "2026-09-03T00:00:00.000Z";
const SESSION_EXPIRY = "2099-01-01T00:10:00.000Z";
const GRANT_EXPIRY = "2099-01-02T00:00:00.000Z";
const MAX_SAFE_INTEGER = "9007199254740991";
const V01_BODY = '{"fixture":"standing-migration-v01"}';

function disposableDatabaseUrl(): string {
  const value = process.env.STANDING_MIGRATION_TEST_DATABASE_URL;
  if (process.env.NODE_ENV !== "test" || !value) {
    throw new Error("Standing migration tests require NODE_ENV=test and an explicit disposable database URL");
  }
  const parsed = new URL(value);
  if (
    !["postgres:", "postgresql:"].includes(parsed.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname) ||
    ![["55432", "/reentry_baseline"], ["55433", "/reentry_closure"]]
      .some(([port, name]) => parsed.port === port && parsed.pathname === name) ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new Error("Standing migration tests are restricted to the task-created loopback baseline database");
  }
  return value;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function insertStandingGrant(client: Client, suffix: string, values: {
  mode?: string;
  maximumActive?: number;
  sequence?: string;
  fingerprint?: string;
} = {}): Promise<string> {
  const prefix = `standing-migration-${suffix}`;
  await client.query(
    `INSERT INTO cr2_standing_consent_sessions
     (consent_session_id, challenge_id, consent_token_digest, organization_id, host_subject_ref_digest,
      expected_origin, manifest_id, manifest_json, expires_at, effective_grant_expires_at,
      status, decision_id, decision_action, decision_at, account_id, created_at)
     VALUES ($1, $2, $3, $4, $5, 'https://standing-migration.example', $6, '{}'::jsonb, $7, $8,
      'approved', $9, 'approve', $10, $11, $10)`,
    [`${prefix}-consent`, `${prefix}-challenge`, digest(`${prefix}-consent`), `${SENTINEL}-organization`,
      digest(`${SENTINEL}-subject`), `${prefix}-manifest`, SESSION_EXPIRY, GRANT_EXPIRY,
      `${prefix}-decision`, CREATED_AT, `${SENTINEL}-user`],
  );
  await client.query(
    `INSERT INTO cr2_standing_grants
     (grant_id, consent_session_id, binding_id, host_subject_binding_id, organization_id, account_id,
      connector_id, delivery_target_id, correlation_id, issuer_origin, issuer_key_id, issuer_key_fingerprint,
      workflow_id, workflow_type, canonical_url, event_type, instruction, human_boundary, continuation_mode,
      authorization_mode, max_active_activations, last_event_sequence, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'https://standing-migration.example', 'standing-key-1', $10,
      'standing-workflow', 'migration_fixture', 'https://standing-migration.example/workflow', 'standing_signal',
      'Read current state and stop at human review.', 'human_review', 'open_canonical_page_read_current_state',
      $11, $12, $13, $14, $15)`,
    [`${prefix}-grant`, `${prefix}-consent`, `${prefix}-public-binding`, `${SENTINEL}-subject-binding`,
      `${SENTINEL}-organization`, `${SENTINEL}-user`, `${SENTINEL}-connector`, `${SENTINEL}-target`,
      `${prefix}-correlation`, values.fingerprint ?? "A".repeat(43), values.mode ?? "standing",
      values.maximumActive ?? 1, values.sequence ?? "0", GRANT_EXPIRY, CREATED_AT],
  );
  return `${prefix}-grant`;
}

async function insertStandingEvent(client: Client, eventId: string, grantId: string, sequence: string): Promise<void> {
  await client.query(
    `INSERT INTO cr2_standing_events
     (event_id, grant_id, event_sequence, canonical_body, acceptance_json, received_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [eventId, grantId, sequence, '{"protocol_version":"0.2"}', '{"accepted":true}', CREATED_AT],
  );
}

async function expectInsertFailure(client: Client, operation: () => Promise<unknown>, code: string): Promise<void> {
  await client.query("SAVEPOINT expected_constraint_failure");
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  await client.query("ROLLBACK TO SAVEPOINT expected_constraint_failure");
  await client.query("RELEASE SAVEPOINT expected_constraint_failure");
  expect(failure).toMatchObject({ code });
}

describe("Standing v0.2 additive PostgreSQL migration", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: disposableDatabaseUrl() });
    await client.connect();
    await seedV01UpgradeSentinel(client);
  });

  afterAll(async () => {
    await client?.end();
  });

  it("supports the v0.1 fixture and frozen uniqueness/sequence constraints after migration", async () => {
    const rows = await client.query(
      `SELECT g.max_runs, g.runs_remaining, e.event_sequence, e.state_version::text, e.canonical_body,
              d.status, d.maximum_attempts
       FROM cr2_grants g JOIN cr2_events e ON e.grant_id = g.grant_id
       JOIN cr2_deliveries d ON d.event_id = e.event_id WHERE g.grant_id = $1`,
      [`${SENTINEL}-grant`],
    );
    expect(rows.rows).toEqual([{
      max_runs: 1, runs_remaining: 0, event_sequence: 1, state_version: "7",
      canonical_body: V01_BODY, status: "pending", maximum_attempts: 3,
    }]);
    const indexes = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'
       AND indexname IN ('cr2_events_grant_id_key', 'cr2_deliveries_grant_id_key') ORDER BY indexname`,
    );
    expect(indexes.rows).toHaveLength(2);
    for (const row of indexes.rows) expect(row.indexdef).toMatch(/CREATE UNIQUE INDEX.*\(grant_id\)/);
    const sequence = await client.query(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conname = 'cr2_events_event_sequence_check'",
    );
    expect(sequence.rows[0]?.definition).toContain("event_sequence = 1");
  });

  it("creates exactly five backend-only standing tables with BIGINT sequence columns", async () => {
    const tables = await client.query(
      `SELECT relname, relrowsecurity FROM pg_class
       WHERE relnamespace = 'public'::regnamespace AND relname = ANY($1::text[]) ORDER BY relname`,
      [[...TABLES]],
    );
    expect(tables.rows.map((row) => row.relname)).toEqual([...TABLES].sort());
    expect(tables.rows.every((row) => row.relrowsecurity === true)).toBe(true);
    const columns = await client.query(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND (table_name, column_name) IN
       (('cr2_standing_grants', 'last_event_sequence'), ('cr2_standing_events', 'event_sequence'))
       ORDER BY table_name`,
    );
    expect(columns.rows).toEqual([
      { table_name: "cr2_standing_events", column_name: "event_sequence", data_type: "bigint" },
      { table_name: "cr2_standing_grants", column_name: "last_event_sequence", data_type: "bigint" },
    ]);
    const publicPrivileges = await client.query(
      `SELECT c.relname FROM pg_class c,
       LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
       WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1::text[]) AND acl.grantee = 0`,
      [[...TABLES]],
    );
    expect(publicPrivileges.rows).toEqual([]);
    const clientRolePrivileges = await client.query(
      `SELECT c.relname, r.rolname FROM pg_class c CROSS JOIN pg_roles r
       WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1::text[])
       AND r.rolname IN ('anon', 'authenticated')
       AND has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')`,
      [[...TABLES]],
    );
    expect(clientRolePrivileges.rows).toEqual([]);
  });

  it("retains multi-event Grants while the partial index fences one open activation", async () => {
    await client.query("BEGIN");
    try {
      const grantId = await insertStandingGrant(client, "slot");
      await insertStandingEvent(client, "standing-migration-slot-event-1", grantId, "1");
      await insertStandingEvent(client, "standing-migration-slot-event-2", grantId, "2");
      const insertDelivery = (id: string, eventId: string) => client.query(
        `INSERT INTO cr2_standing_deliveries (delivery_id, event_id, grant_id, delivery_target_id)
         VALUES ($1, $2, $3, $4)`,
        [id, eventId, grantId, `${SENTINEL}-target`],
      );
      await insertDelivery("standing-migration-slot-delivery-1", "standing-migration-slot-event-1");
      await expectInsertFailure(client, () => insertDelivery(
        "standing-migration-slot-delivery-2", "standing-migration-slot-event-2",
      ), "23505");
      await expectInsertFailure(client, () => insertStandingEvent(
        client, "standing-migration-slot-sequence-conflict", grantId, "1",
      ), "23505");
      const index = await client.query(
        `SELECT indexdef FROM pg_indexes WHERE schemaname = 'public'
         AND indexname = 'cr2_standing_deliveries_one_open'`,
      );
      expect(index.rows[0]?.indexdef).toMatch(/UNIQUE INDEX.*\(grant_id\).*WHERE/);
      expect(index.rows[0]?.indexdef).toContain("pending");
      expect(index.rows[0]?.indexdef).toContain("leased");

      const historicalGrant = await insertStandingGrant(client, "historical-slot");
      await insertStandingEvent(client, "standing-migration-historical-event-1", historicalGrant, "1");
      await insertStandingEvent(client, "standing-migration-historical-event-2", historicalGrant, "2");
      await client.query(
        `INSERT INTO cr2_standing_deliveries
         (delivery_id, event_id, grant_id, delivery_target_id, status, current_attempt, current_connector_id,
          current_claim_token_digest, current_lease_token_digest, lease_started_at, lease_expires_at,
          effect_id, effect_attestation_json, acknowledged_at, created_at, updated_at)
         VALUES ('standing-migration-historical-delivery-1', 'standing-migration-historical-event-1', $1, $2,
          'acknowledged', 1, $3, $4, $4, $5, '2026-09-03T00:01:00.000Z',
          'standing-migration-historical-effect', '{"fixture":"ack"}', '2026-09-03T00:00:30.000Z', $5, $5)`,
        [historicalGrant, `${SENTINEL}-target`, `${SENTINEL}-connector`, digest("historical-slot-lease"), CREATED_AT],
      );
      await client.query(
        `INSERT INTO cr2_standing_deliveries (delivery_id, event_id, grant_id, delivery_target_id)
         VALUES ('standing-migration-historical-delivery-2', 'standing-migration-historical-event-2', $1, $2)`,
        [historicalGrant, `${SENTINEL}-target`],
      );
      const historicalCount = await client.query(
        "SELECT count(*)::int AS count FROM cr2_standing_deliveries WHERE grant_id = $1",
        [historicalGrant],
      );
      expect(historicalCount.rows[0]?.count).toBe(2);
    } finally {
      await client.query("ROLLBACK");
    }
  });

  it("rejects unsafe sequence, authorization, key-pin and Delivery state inserts", async () => {
    await client.query("BEGIN");
    try {
      const grantId = await insertStandingGrant(client, "checks");
      for (const sequence of ["0", "-1", "9007199254740992"]) {
        await expectInsertFailure(client, () => insertStandingEvent(
          client, `standing-migration-invalid-sequence-${sequence}`, grantId, sequence,
        ), "23514");
      }
      await insertStandingEvent(client, "standing-migration-max-safe-event", grantId, MAX_SAFE_INTEGER);
      await expectInsertFailure(client, () => insertStandingGrant(client, "bad-mode", { mode: "one-shot" }), "23514");
      await expectInsertFailure(client, () => insertStandingGrant(client, "bad-active", { maximumActive: 2 }), "23514");
      await expectInsertFailure(client, () => insertStandingGrant(client, "bad-grant-sequence", { sequence: "-1" }), "23514");
      await expectInsertFailure(client, () => insertStandingGrant(client, "bad-pin", { fingerprint: `${"A".repeat(42)}B` }), "23514");
      await expectInsertFailure(client, () => client.query(
        `INSERT INTO cr2_standing_deliveries
         (delivery_id, event_id, grant_id, delivery_target_id, current_attempt)
         VALUES ('standing-migration-invalid-pending', 'standing-migration-max-safe-event', $1, $2, 1)`,
        [grantId, `${SENTINEL}-target`],
      ), "23514");
      await expectInsertFailure(client, () => client.query(
        `INSERT INTO cr2_standing_deliveries
         (delivery_id, event_id, grant_id, delivery_target_id, status)
         VALUES ('standing-migration-invalid-ack', 'standing-migration-max-safe-event', $1, $2, 'acknowledged')`,
        [grantId, `${SENTINEL}-target`],
      ), "23514");
      await expectInsertFailure(client, () => client.query(
        `INSERT INTO cr2_standing_consent_sessions
         (consent_session_id, challenge_id, consent_token_digest, organization_id, host_subject_ref_digest,
          expected_origin, manifest_id, manifest_json, expires_at, effective_grant_expires_at,
          status, decision_id, decision_at, account_id, created_at)
         VALUES ('standing-migration-null-decision-action', 'standing-migration-null-action-challenge',
          $1, $2, $3, 'https://standing-migration.example', 'standing-migration-null-action-manifest',
          '{}'::jsonb, $4, $5, 'approved', 'standing-migration-null-action-decision', $6, $7, $6)`,
        [digest("standing-migration-null-action"), `${SENTINEL}-organization`, digest(`${SENTINEL}-subject`),
          SESSION_EXPIRY, GRANT_EXPIRY, CREATED_AT, `${SENTINEL}-user`],
      ), "23514");
      await expectInsertFailure(client, () => client.query(
        `INSERT INTO cr2_standing_consent_sessions
         (consent_session_id, challenge_id, consent_token_digest, organization_id,
          host_subject_ref_digest, expected_origin, manifest_id, manifest_json,
          expires_at, effective_grant_expires_at, created_at)
         VALUES ('standing-migration-inverted-lifetime',
          'standing-migration-inverted-lifetime-challenge', $1, $2, $3,
          'https://standing-migration.example', 'standing-migration-inverted-lifetime-manifest',
          '{}'::jsonb, $4, $5, $6)`,
        [
          digest("standing-migration-inverted-lifetime"),
          `${SENTINEL}-organization`,
          digest(`${SENTINEL}-subject`),
          GRANT_EXPIRY,
          SESSION_EXPIRY,
          CREATED_AT,
        ],
      ), "23514");

      const claimDigest = digest("standing-migration-valid-attempt");
      await client.query(
        `INSERT INTO cr2_standing_deliveries
         (delivery_id, event_id, grant_id, delivery_target_id, status, current_attempt, current_connector_id,
          current_claim_token_digest, current_lease_token_digest, lease_started_at, lease_expires_at, created_at, updated_at)
         VALUES ('standing-migration-attempt-delivery', 'standing-migration-max-safe-event', $1, $2, 'leased',
          1, $3, $4, $4, $5, '2026-09-03T00:01:00.000Z', $5, $5)`,
        [grantId, `${SENTINEL}-target`, `${SENTINEL}-connector`, claimDigest, CREATED_AT],
      );
      const insertAttempt = (id: string, attempt: number, tokenDigest: string) => client.query(
        `INSERT INTO cr2_standing_delivery_attempts
         (attempt_id, delivery_id, connector_id, attempt, claim_token_digest, lease_token_digest,
          lease_started_at, lease_expires_at, created_at)
         VALUES ($1, 'standing-migration-attempt-delivery', $2, $3, $4, $4, $5, '2026-09-03T00:01:00.000Z', $5)`,
        [id, `${SENTINEL}-connector`, attempt, tokenDigest, CREATED_AT],
      );
      await insertAttempt("standing-migration-attempt-1", 1, claimDigest);
      await expectInsertFailure(client, () => insertAttempt("standing-migration-attempt-4", 4, digest("attempt-4")), "23514");
      await expectInsertFailure(client, () => insertAttempt("standing-migration-attempt-raw", 2, "raw-token-not-a-digest"), "23514");
      await expectInsertFailure(client, () => insertAttempt("standing-migration-attempt-replay", 2, claimDigest), "23505");
    } finally {
      await client.query("ROLLBACK");
    }
  });

  it("rejects a Delivery whose Event belongs to another Grant", async () => {
    await client.query("BEGIN");
    try {
      const eventGrant = await insertStandingGrant(client, "event-owner");
      const otherGrant = await insertStandingGrant(client, "other-owner");
      await insertStandingEvent(client, "standing-migration-owned-event", eventGrant, "1");
      await expectInsertFailure(client, () => client.query(
        `INSERT INTO cr2_standing_deliveries (delivery_id, event_id, grant_id, delivery_target_id)
         VALUES ('standing-migration-wrong-grant', 'standing-migration-owned-event', $1, $2)`,
        [otherGrant, `${SENTINEL}-target`],
      ), "23503");
    } finally {
      await client.query("ROLLBACK");
    }
  });

  it("installs and executes an always-enabled immutable consented-key trigger", async () => {
    const triggers = await client.query(
      `SELECT t.tgenabled, pg_get_triggerdef(t.oid) AS definition, pg_get_functiondef(t.tgfoid) AS function_definition
       FROM pg_trigger t WHERE t.tgrelid = to_regclass('public.cr2_standing_grants')
       AND t.tgname = 'cr2_standing_grants_key_pin_immutable' AND NOT t.tgisinternal`,
    );
    expect(triggers.rows).toHaveLength(1);
    expect(triggers.rows[0]?.tgenabled).toBe("A");
    expect(triggers.rows[0]?.definition).toMatch(/BEFORE UPDATE OF issuer_key_id, issuer_key_fingerprint/);
    expect(triggers.rows[0]?.function_definition).toContain("IS DISTINCT FROM");
    expect(triggers.rows[0]?.function_definition).toContain("standing_grant_key_pin_immutable");

    await client.query("BEGIN");
    try {
      const grantId = await insertStandingGrant(client, "immutable-key-runtime");
      await expectInsertFailure(
        client,
        () => client.query(
          `UPDATE cr2_standing_grants SET issuer_key_id = 'standing-key-2'
           WHERE grant_id = $1`,
          [grantId],
        ),
        "23514",
      );
      const retained = await client.query(
        `SELECT issuer_key_id, issuer_key_fingerprint
         FROM cr2_standing_grants WHERE grant_id = $1`,
        [grantId],
      );
      expect(retained.rows).toEqual([{
        issuer_key_id: "standing-key-1",
        issuer_key_fingerprint: "A".repeat(43),
      }]);
    } finally {
      // The runtime probe is task-owned and leaves no stored Grant behind.
      await client.query("ROLLBACK");
    }
  });
});
