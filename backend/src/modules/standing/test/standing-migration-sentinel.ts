import { createHash } from "node:crypto";
import type { Client } from "pg";

const SENTINEL = "standing-migration-v01";
const CREATED_AT = "2026-09-03T00:00:00.000Z";
const SESSION_EXPIRY = "2099-01-01T00:10:00.000Z";
const GRANT_EXPIRY = "2099-01-02T00:00:00.000Z";
const V01_BODY = '{"fixture":"standing-migration-v01"}';
const digest = (value: string): string => createHash("sha256").update(value).digest("hex");

// Test-only shared fixture. The upgrade harness calls this exactly once, before
// applying v0.2, and compares all rows before the ordinary suite can upsert them.
// A post-migration suite pass alone is not proof that pre-existing rows survived.
export async function seedV01UpgradeSentinel(client: Client): Promise<void> {
  await client.query("BEGIN");
  try {
    await client.query(
      `INSERT INTO cr2_user_accounts (id, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, 'test-only-not-a-password', $3, $3) ON CONFLICT (id) DO NOTHING`,
      [`${SENTINEL}-user`, `${SENTINEL}-user@example.invalid`, CREATED_AT],
    );
    await client.query(
      `INSERT INTO cr2_developer_accounts (id, email, password_hash, created_at, updated_at)
       VALUES ($1, $2, 'test-only-not-a-password', $3, $3) ON CONFLICT (id) DO NOTHING`,
      [`${SENTINEL}-developer`, `${SENTINEL}-developer@example.invalid`, CREATED_AT],
    );
    await client.query(
      `INSERT INTO cr2_organizations (organization_id, developer_id, name, created_at, updated_at)
       VALUES ($1, $2, 'Standing migration upgrade sentinel', $3, $3)
       ON CONFLICT (organization_id) DO NOTHING`,
      [`${SENTINEL}-organization`, `${SENTINEL}-developer`, CREATED_AT],
    );
    await client.query(
      `INSERT INTO cr2_pairing_sessions (pairing_id, account_id, pairing_code_digest, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (pairing_id) DO NOTHING`,
      [`${SENTINEL}-pairing`, `${SENTINEL}-user`, digest(`${SENTINEL}-pairing`), CREATED_AT, GRANT_EXPIRY],
    );
    await client.query(
      `INSERT INTO cr2_connectors
       (connector_id, account_id, pairing_id, delivery_target_id, connector_token_digest, device_name, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'Migration test target', $6, $7)
       ON CONFLICT (connector_id) DO NOTHING`,
      [`${SENTINEL}-connector`, `${SENTINEL}-user`, `${SENTINEL}-pairing`, `${SENTINEL}-target`,
        digest(`${SENTINEL}-connector`), CREATED_AT, GRANT_EXPIRY],
    );
    await client.query(
      `INSERT INTO cr2_host_subject_bindings
       (binding_id, organization_id, host_subject_ref_digest, connector_id, delivery_target_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (binding_id) DO NOTHING`,
      [`${SENTINEL}-subject-binding`, `${SENTINEL}-organization`, digest(`${SENTINEL}-subject`),
        `${SENTINEL}-connector`, `${SENTINEL}-target`, CREATED_AT],
    );
    await client.query(
      `INSERT INTO cr2_consent_sessions
       (consent_session_id, challenge_id, consent_token_digest, organization_id, host_subject_ref_digest,
        expected_origin, manifest_id, manifest_json, expires_at, status, decision_action, decision_at, account_id, created_at)
       VALUES ($1, $2, $3, $4, $5, 'https://standing-migration.example', $6, '{}'::jsonb, $7,
        'approved', 'approve', $8, $9, $8) ON CONFLICT (consent_session_id) DO NOTHING`,
      [`${SENTINEL}-consent`, `${SENTINEL}-challenge`, digest(`${SENTINEL}-consent`),
        `${SENTINEL}-organization`, digest(`${SENTINEL}-subject`), `${SENTINEL}-manifest`,
        SESSION_EXPIRY, CREATED_AT, `${SENTINEL}-user`],
    );
    await client.query(
      `INSERT INTO cr2_grants
       (grant_id, consent_session_id, organization_id, binding_id, account_id, connector_id, delivery_target_id,
        correlation_id, issuer_origin, workflow_id, workflow_type, canonical_url, event_type, human_boundary,
        expires_at, max_runs, runs_remaining, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'https://standing-migration.example', 'upgrade-workflow',
        'migration_fixture', 'https://standing-migration.example/workflow', 'upgrade_signal', 'human_review',
        $9, 1, 0, $10) ON CONFLICT (grant_id) DO NOTHING`,
      [`${SENTINEL}-grant`, `${SENTINEL}-consent`, `${SENTINEL}-organization`, `${SENTINEL}-subject-binding`,
        `${SENTINEL}-user`, `${SENTINEL}-connector`, `${SENTINEL}-target`, `${SENTINEL}-correlation`,
        SESSION_EXPIRY, CREATED_AT],
    );
    await client.query(
      `INSERT INTO cr2_events
       (event_id, grant_id, binding_id, correlation_id, issuer_origin, workflow_id, event_type,
        event_sequence, state_version, occurred_at, canonical_url, canonical_body, received_at)
       VALUES ($1, $2, $3, $4, 'https://standing-migration.example', 'upgrade-workflow', 'upgrade_signal',
        1, 7, $5, 'https://standing-migration.example/workflow', $6, $5)
       ON CONFLICT (event_id) DO NOTHING`,
      [`${SENTINEL}-event`, `${SENTINEL}-grant`, `${SENTINEL}-subject-binding`,
        `${SENTINEL}-correlation`, CREATED_AT, V01_BODY],
    );
    await client.query(
      `INSERT INTO cr2_deliveries (delivery_id, event_id, grant_id, delivery_target_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, $5) ON CONFLICT (delivery_id) DO NOTHING`,
      [`${SENTINEL}-delivery`, `${SENTINEL}-event`, `${SENTINEL}-grant`, `${SENTINEL}-target`, CREATED_AT],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
