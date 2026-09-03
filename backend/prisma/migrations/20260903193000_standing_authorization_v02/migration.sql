-- Additive standing-v0.2 authority. No v0.1 table, row, index, or constraint changes.
-- Apply only after exact-source review and disposable PostgreSQL verification.
-- Rollback is application rollback with v0.2 routing disabled and these rows retained;
-- destructive schema reversal or restore requires a separately authorized recovery plan.
BEGIN;

CREATE TABLE "cr2_standing_consent_sessions" (
    "consent_session_id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "consent_token_digest" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "host_subject_ref_digest" TEXT NOT NULL,
    "expected_origin" TEXT NOT NULL,
    "manifest_id" TEXT NOT NULL,
    "manifest_json" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "effective_grant_expires_at" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decision_id" TEXT,
    "decision_action" TEXT,
    "decision_at" TIMESTAMP(3),
    "account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cr2_standing_consent_sessions_pkey" PRIMARY KEY ("consent_session_id"),
    CONSTRAINT "cr2_standing_consent_digests_check" CHECK (
        "consent_token_digest" ~ '^[0-9a-f]{64}$'
        AND "host_subject_ref_digest" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "cr2_standing_consent_manifest_check" CHECK (jsonb_typeof("manifest_json") = 'object'),
    CONSTRAINT "cr2_standing_consent_lifetime_check" CHECK (
        "expires_at" > "created_at"
        AND "effective_grant_expires_at" >= "expires_at"
    ),
    CONSTRAINT "cr2_standing_consent_decision_check" CHECK (
        ("status" = 'pending' AND "decision_id" IS NULL AND "decision_action" IS NULL
            AND "decision_at" IS NULL AND "account_id" IS NULL)
        OR
        ("status" = 'approved' AND "decision_id" IS NOT NULL AND "decision_action" IS NOT NULL AND "decision_action" = 'approve'
            AND "decision_at" IS NOT NULL AND "account_id" IS NOT NULL
            AND "decision_at" >= "created_at" AND "decision_at" < "expires_at"
            AND "decision_at" < "effective_grant_expires_at")
        OR
        ("status" = 'declined' AND "decision_id" IS NOT NULL AND "decision_action" IS NOT NULL AND "decision_action" = 'decline'
            AND "decision_at" IS NOT NULL AND "account_id" IS NOT NULL
            AND "decision_at" >= "created_at" AND "decision_at" < "expires_at")
    )
);

CREATE TABLE "cr2_standing_grants" (
    "grant_id" TEXT NOT NULL,
    "consent_session_id" TEXT NOT NULL,
    "binding_id" TEXT NOT NULL,
    "host_subject_binding_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "delivery_target_id" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "issuer_origin" TEXT NOT NULL,
    "issuer_key_id" TEXT NOT NULL,
    "issuer_key_fingerprint" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "workflow_type" TEXT NOT NULL,
    "canonical_url" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "instruction" TEXT NOT NULL,
    "human_boundary" TEXT NOT NULL,
    "continuation_mode" TEXT NOT NULL DEFAULT 'open_canonical_page_read_current_state',
    "authorization_mode" TEXT NOT NULL DEFAULT 'standing',
    "max_active_activations" INTEGER NOT NULL DEFAULT 1,
    "last_event_sequence" BIGINT NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cr2_standing_grants_pkey" PRIMARY KEY ("grant_id"),
    CONSTRAINT "cr2_standing_grants_mode_check" CHECK ("authorization_mode" = 'standing'),
    CONSTRAINT "cr2_standing_grants_active_limit_check" CHECK ("max_active_activations" = 1),
    CONSTRAINT "cr2_standing_grants_sequence_check" CHECK (
        "last_event_sequence" BETWEEN 0 AND 9007199254740991
    ),
    CONSTRAINT "cr2_standing_grants_key_pin_check" CHECK (
        "issuer_key_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
        AND octet_length("issuer_key_id") <= 160
        AND "issuer_key_fingerprint" ~ '^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$'
    ),
    CONSTRAINT "cr2_standing_grants_instruction_check" CHECK (
        octet_length("instruction") BETWEEN 1 AND 500
        AND "instruction" = btrim("instruction")
        AND "instruction" !~ '[[:cntrl:]]'
    ),
    CONSTRAINT "cr2_standing_grants_continuation_check" CHECK (
        "continuation_mode" = 'open_canonical_page_read_current_state'
    ),
    CONSTRAINT "cr2_standing_grants_lifetime_check" CHECK (
        "expires_at" > "created_at" AND ("revoked_at" IS NULL OR "revoked_at" >= "created_at")
    )
);

CREATE TABLE "cr2_standing_events" (
    "event_id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "event_sequence" BIGINT NOT NULL,
    "canonical_body" TEXT NOT NULL,
    "acceptance_json" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cr2_standing_events_pkey" PRIMARY KEY ("event_id"),
    CONSTRAINT "cr2_standing_events_sequence_check" CHECK (
        "event_sequence" BETWEEN 1 AND 9007199254740991
    ),
    CONSTRAINT "cr2_standing_events_body_check" CHECK (
        octet_length("canonical_body") BETWEEN 1 AND 8192
        AND octet_length("acceptance_json") BETWEEN 1 AND 32768
    )
);

CREATE TABLE "cr2_standing_deliveries" (
    "delivery_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "grant_id" TEXT NOT NULL,
    "delivery_target_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "maximum_attempts" INTEGER NOT NULL DEFAULT 3,
    "current_attempt" INTEGER NOT NULL DEFAULT 0,
    "current_connector_id" TEXT,
    "current_claim_token_digest" TEXT,
    "current_lease_token_digest" TEXT,
    "lease_started_at" TIMESTAMP(3),
    "lease_expires_at" TIMESTAMP(3),
    "effect_id" TEXT,
    "effect_attestation_json" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "terminal_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cr2_standing_deliveries_pkey" PRIMARY KEY ("delivery_id"),
    CONSTRAINT "cr2_standing_deliveries_attempt_check" CHECK (
        "maximum_attempts" = 3 AND "current_attempt" BETWEEN 0 AND "maximum_attempts"
    ),
    CONSTRAINT "cr2_standing_deliveries_digest_check" CHECK (
        ("current_claim_token_digest" IS NULL OR "current_claim_token_digest" ~ '^[0-9a-f]{64}$')
        AND ("current_lease_token_digest" IS NULL OR "current_lease_token_digest" ~ '^[0-9a-f]{64}$')
    ),
    CONSTRAINT "cr2_standing_deliveries_time_check" CHECK (
        "updated_at" >= "created_at"
        AND ("lease_expires_at" IS NULL OR "lease_expires_at" > "lease_started_at")
        AND ("acknowledged_at" IS NULL OR "acknowledged_at" >= "created_at")
    ),
    CONSTRAINT "cr2_standing_deliveries_effect_check" CHECK (
        ("effect_id" IS NULL OR "effect_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$')
        AND ("effect_attestation_json" IS NULL OR octet_length("effect_attestation_json") BETWEEN 1 AND 8192)
        AND ("terminal_reason" IS NULL OR "terminal_reason" ~ '^[a-z][a-z0-9_]{0,95}$')
    ),
    CONSTRAINT "cr2_standing_deliveries_state_check" CHECK (
        ("status" = 'pending' AND "current_attempt" = 0 AND "current_connector_id" IS NULL
            AND "current_claim_token_digest" IS NULL AND "current_lease_token_digest" IS NULL
            AND "lease_started_at" IS NULL AND "lease_expires_at" IS NULL
            AND "effect_id" IS NULL AND "effect_attestation_json" IS NULL
            AND "acknowledged_at" IS NULL AND "terminal_reason" IS NULL)
        OR
        ("status" = 'leased' AND "current_attempt" BETWEEN 1 AND 3 AND "current_connector_id" IS NOT NULL
            AND "current_claim_token_digest" IS NOT NULL AND "current_lease_token_digest" IS NOT NULL
            AND "lease_started_at" IS NOT NULL AND "lease_expires_at" IS NOT NULL
            AND "effect_id" IS NULL AND "effect_attestation_json" IS NULL
            AND "acknowledged_at" IS NULL AND "terminal_reason" IS NULL)
        OR
        ("status" = 'acknowledged' AND "current_attempt" BETWEEN 1 AND 3 AND "current_connector_id" IS NOT NULL
            AND "current_claim_token_digest" IS NOT NULL AND "current_lease_token_digest" IS NOT NULL
            AND "lease_started_at" IS NOT NULL AND "lease_expires_at" IS NOT NULL
            AND "effect_id" IS NOT NULL AND "effect_attestation_json" IS NOT NULL
            AND "acknowledged_at" IS NOT NULL AND "terminal_reason" IS NULL)
        OR
        ("status" = 'retry_exhausted' AND "current_attempt" BETWEEN 1 AND 3 AND "current_connector_id" IS NOT NULL
            AND "current_claim_token_digest" IS NOT NULL AND "current_lease_token_digest" IS NOT NULL
            AND "lease_started_at" IS NOT NULL AND "lease_expires_at" IS NOT NULL
            AND "effect_id" IS NULL AND "effect_attestation_json" IS NULL
            AND "acknowledged_at" IS NULL AND "terminal_reason" IS NOT NULL)
        OR
        ("status" = 'cancelled' AND "current_attempt" = 0 AND "current_connector_id" IS NULL
            AND "current_claim_token_digest" IS NULL AND "current_lease_token_digest" IS NULL
            AND "lease_started_at" IS NULL AND "lease_expires_at" IS NULL
            AND "effect_id" IS NULL AND "effect_attestation_json" IS NULL
            AND "acknowledged_at" IS NULL AND "terminal_reason" IS NOT NULL)
    )
);

CREATE TABLE "cr2_standing_delivery_attempts" (
    "attempt_id" TEXT NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "connector_id" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "claim_token_digest" TEXT NOT NULL,
    "lease_token_digest" TEXT NOT NULL,
    "lease_started_at" TIMESTAMP(3) NOT NULL,
    "lease_expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cr2_standing_delivery_attempts_pkey" PRIMARY KEY ("attempt_id"),
    CONSTRAINT "cr2_standing_attempt_number_check" CHECK ("attempt" BETWEEN 1 AND 3),
    CONSTRAINT "cr2_standing_attempt_digests_check" CHECK (
        "claim_token_digest" ~ '^[0-9a-f]{64}$' AND "lease_token_digest" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "cr2_standing_attempt_lease_check" CHECK ("lease_expires_at" > "lease_started_at")
);

CREATE UNIQUE INDEX "cr2_standing_consent_sessions_challenge_id_key"
    ON "cr2_standing_consent_sessions"("challenge_id");
CREATE UNIQUE INDEX "cr2_standing_consent_sessions_consent_token_digest_key"
    ON "cr2_standing_consent_sessions"("consent_token_digest");
CREATE UNIQUE INDEX "cr2_standing_consent_sessions_decision_id_key"
    ON "cr2_standing_consent_sessions"("decision_id");
CREATE UNIQUE INDEX "cr2_standing_consent_org_manifest_key"
    ON "cr2_standing_consent_sessions"("organization_id", "manifest_id");
CREATE INDEX "cr2_standing_consent_org_subject_idx"
    ON "cr2_standing_consent_sessions"("organization_id", "host_subject_ref_digest");
CREATE INDEX "cr2_standing_consent_account_status_idx"
    ON "cr2_standing_consent_sessions"("account_id", "status");
CREATE UNIQUE INDEX "cr2_standing_grants_consent_session_id_key"
    ON "cr2_standing_grants"("consent_session_id");
CREATE UNIQUE INDEX "cr2_standing_grants_binding_id_key"
    ON "cr2_standing_grants"("binding_id");
CREATE INDEX "cr2_standing_grants_account_id_created_at_idx"
    ON "cr2_standing_grants"("account_id", "created_at");
CREATE INDEX "cr2_standing_grants_org_subject_binding_idx"
    ON "cr2_standing_grants"("organization_id", "host_subject_binding_id");
CREATE INDEX "cr2_standing_grants_connector_id_idx"
    ON "cr2_standing_grants"("connector_id");
CREATE UNIQUE INDEX "cr2_standing_events_grant_id_event_sequence_key"
    ON "cr2_standing_events"("grant_id", "event_sequence");
CREATE UNIQUE INDEX "cr2_standing_events_event_id_grant_id_key"
    ON "cr2_standing_events"("event_id", "grant_id");
CREATE UNIQUE INDEX "cr2_standing_deliveries_event_id_key"
    ON "cr2_standing_deliveries"("event_id");
CREATE UNIQUE INDEX "cr2_standing_deliveries_event_id_grant_id_key"
    ON "cr2_standing_deliveries"("event_id", "grant_id");
CREATE UNIQUE INDEX "cr2_standing_deliveries_effect_id_key"
    ON "cr2_standing_deliveries"("effect_id");
CREATE INDEX "cr2_standing_deliveries_target_queue_idx"
    ON "cr2_standing_deliveries"("delivery_target_id", "status", "created_at", "delivery_id");
CREATE INDEX "cr2_standing_deliveries_status_lease_expires_at_idx"
    ON "cr2_standing_deliveries"("status", "lease_expires_at");
CREATE UNIQUE INDEX "cr2_standing_deliveries_one_open"
    ON "cr2_standing_deliveries"("grant_id") WHERE "status" IN ('pending', 'leased');
CREATE UNIQUE INDEX "cr2_standing_delivery_attempts_claim_token_digest_key"
    ON "cr2_standing_delivery_attempts"("claim_token_digest");
CREATE UNIQUE INDEX "cr2_standing_delivery_attempts_lease_token_digest_key"
    ON "cr2_standing_delivery_attempts"("lease_token_digest");
CREATE UNIQUE INDEX "cr2_standing_delivery_attempts_delivery_id_attempt_key"
    ON "cr2_standing_delivery_attempts"("delivery_id", "attempt");
CREATE INDEX "cr2_standing_delivery_attempts_connector_id_idx"
    ON "cr2_standing_delivery_attempts"("connector_id");

-- RESTRICT preserves standing authority/audit history instead of inheriting
-- v0.1 account/organization/Connector cascade-deletion behavior.
ALTER TABLE "cr2_standing_consent_sessions"
    ADD CONSTRAINT "cr2_standing_consent_sessions_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "cr2_organizations"("organization_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "cr2_standing_consent_sessions_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "cr2_user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "cr2_standing_grants"
    ADD CONSTRAINT "cr2_standing_grants_consent_session_id_fkey"
    FOREIGN KEY ("consent_session_id") REFERENCES "cr2_standing_consent_sessions"("consent_session_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "cr2_standing_grants_host_subject_binding_id_fkey"
    FOREIGN KEY ("host_subject_binding_id") REFERENCES "cr2_host_subject_bindings"("binding_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "cr2_standing_grants_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "cr2_organizations"("organization_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "cr2_standing_grants_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "cr2_user_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "cr2_standing_grants_connector_id_fkey"
    FOREIGN KEY ("connector_id") REFERENCES "cr2_connectors"("connector_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "cr2_standing_events"
    ADD CONSTRAINT "cr2_standing_events_grant_id_fkey"
    FOREIGN KEY ("grant_id") REFERENCES "cr2_standing_grants"("grant_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "cr2_standing_deliveries"
    ADD CONSTRAINT "cr2_standing_deliveries_event_id_grant_id_fkey"
    FOREIGN KEY ("event_id", "grant_id") REFERENCES "cr2_standing_events"("event_id", "grant_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "cr2_standing_deliveries_grant_id_fkey"
    FOREIGN KEY ("grant_id") REFERENCES "cr2_standing_grants"("grant_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "cr2_standing_deliveries_current_connector_id_fkey"
    FOREIGN KEY ("current_connector_id") REFERENCES "cr2_connectors"("connector_id") ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE "cr2_standing_delivery_attempts"
    ADD CONSTRAINT "cr2_standing_delivery_attempts_delivery_id_fkey"
    FOREIGN KEY ("delivery_id") REFERENCES "cr2_standing_deliveries"("delivery_id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    ADD CONSTRAINT "cr2_standing_delivery_attempts_connector_id_fkey"
    FOREIGN KEY ("connector_id") REFERENCES "cr2_connectors"("connector_id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION "cr2_standing_grant_key_pin_guard"() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
    IF NEW.issuer_key_id IS DISTINCT FROM OLD.issuer_key_id
       OR NEW.issuer_key_fingerprint IS DISTINCT FROM OLD.issuer_key_fingerprint THEN
        RAISE EXCEPTION 'standing_grant_key_pin_immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL PRIVILEGES ON FUNCTION "cr2_standing_grant_key_pin_guard"() FROM PUBLIC;
CREATE TRIGGER "cr2_standing_grants_key_pin_immutable"
    BEFORE UPDATE OF "issuer_key_id", "issuer_key_fingerprint" ON "cr2_standing_grants"
    FOR EACH ROW EXECUTE FUNCTION "cr2_standing_grant_key_pin_guard"();
ALTER TABLE "cr2_standing_grants" ENABLE ALWAYS TRIGGER "cr2_standing_grants_key_pin_immutable";

-- Match the backend-only Supabase boundary without touching older tables or
-- requiring Supabase-specific roles in a disposable plain-PostgreSQL database.
-- No browser/Connector policies are created. Runtime access remains the table
-- owner or the explicitly configured service role, as in the prior hardening.
DO $$
DECLARE
    standing_table text;
    client_role text;
BEGIN
    FOREACH standing_table IN ARRAY ARRAY[
        'cr2_standing_consent_sessions', 'cr2_standing_grants', 'cr2_standing_events',
        'cr2_standing_deliveries', 'cr2_standing_delivery_attempts'
    ] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', standing_table);
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', standing_table);
        FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
                EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', standing_table, client_role);
            END IF;
        END LOOP;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
            EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', standing_table);
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        GRANT EXECUTE ON FUNCTION "cr2_standing_grant_key_pin_guard"() TO service_role;
    END IF;
END;
$$;

COMMIT;
