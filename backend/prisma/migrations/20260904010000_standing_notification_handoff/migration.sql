-- Additive standing notification handoff persistence.
-- A handoff is a terminal Receiver decision for the current delivery lease;
-- it does not alter the existing v0.1 tables or acknowledgement contract.
BEGIN;

ALTER TABLE "cr2_standing_deliveries"
    ADD COLUMN "handoff_id" TEXT,
    ADD COLUMN "runtime_admission_json" TEXT,
    ADD COLUMN "handoff_receipt_json" TEXT,
    ADD COLUMN "handoff_accepted_at" TIMESTAMP(3);

ALTER TABLE "cr2_standing_deliveries"
    DROP CONSTRAINT "cr2_standing_deliveries_time_check",
    DROP CONSTRAINT "cr2_standing_deliveries_effect_check",
    DROP CONSTRAINT "cr2_standing_deliveries_state_check";

ALTER TABLE "cr2_standing_deliveries"
    ADD CONSTRAINT "cr2_standing_deliveries_time_check" CHECK (
        "updated_at" >= "created_at"
        AND ("lease_expires_at" IS NULL OR "lease_expires_at" > "lease_started_at")
        AND ("acknowledged_at" IS NULL OR "acknowledged_at" >= "created_at")
        AND ("handoff_accepted_at" IS NULL OR "handoff_accepted_at" >= "created_at")
    ),
    ADD CONSTRAINT "cr2_standing_deliveries_effect_check" CHECK (
        ("effect_id" IS NULL OR "effect_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$')
        AND ("effect_attestation_json" IS NULL OR octet_length("effect_attestation_json") BETWEEN 1 AND 8192)
        AND ("terminal_reason" IS NULL OR "terminal_reason" ~ '^[a-z][a-z0-9_]{0,95}$')
        AND ("handoff_id" IS NULL OR "handoff_id" ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$')
        AND ("runtime_admission_json" IS NULL OR octet_length("runtime_admission_json") BETWEEN 1 AND 8192)
        AND ("handoff_receipt_json" IS NULL OR octet_length("handoff_receipt_json") BETWEEN 1 AND 8192)
    ),
    ADD CONSTRAINT "cr2_standing_deliveries_state_check" CHECK (
        ("status" = 'pending' AND "current_attempt" = 0 AND "current_connector_id" IS NULL
            AND "current_claim_token_digest" IS NULL AND "current_lease_token_digest" IS NULL
            AND "lease_started_at" IS NULL AND "lease_expires_at" IS NULL
            AND "effect_id" IS NULL AND "effect_attestation_json" IS NULL
            AND "acknowledged_at" IS NULL AND "terminal_reason" IS NULL
            AND "handoff_id" IS NULL AND "runtime_admission_json" IS NULL
            AND "handoff_receipt_json" IS NULL AND "handoff_accepted_at" IS NULL)
        OR
        ("status" = 'leased' AND "current_attempt" BETWEEN 1 AND 3 AND "current_connector_id" IS NOT NULL
            AND "current_claim_token_digest" IS NOT NULL AND "current_lease_token_digest" IS NOT NULL
            AND "lease_started_at" IS NOT NULL AND "lease_expires_at" IS NOT NULL
            AND "effect_id" IS NULL AND "effect_attestation_json" IS NULL
            AND "acknowledged_at" IS NULL AND "terminal_reason" IS NULL
            AND "handoff_id" IS NULL AND "runtime_admission_json" IS NULL
            AND "handoff_receipt_json" IS NULL AND "handoff_accepted_at" IS NULL)
        OR
        ("status" = 'acknowledged' AND "current_attempt" BETWEEN 1 AND 3 AND "current_connector_id" IS NOT NULL
            AND "current_claim_token_digest" IS NOT NULL AND "current_lease_token_digest" IS NOT NULL
            AND "lease_started_at" IS NOT NULL AND "lease_expires_at" IS NOT NULL
            AND "effect_id" IS NOT NULL AND "effect_attestation_json" IS NOT NULL
            AND "acknowledged_at" IS NOT NULL AND "terminal_reason" IS NULL
            AND "handoff_id" IS NULL AND "runtime_admission_json" IS NULL
            AND "handoff_receipt_json" IS NULL AND "handoff_accepted_at" IS NULL)
        OR
        ("status" = 'retry_exhausted' AND "current_attempt" BETWEEN 1 AND 3 AND "current_connector_id" IS NOT NULL
            AND "current_claim_token_digest" IS NOT NULL AND "current_lease_token_digest" IS NOT NULL
            AND "lease_started_at" IS NOT NULL AND "lease_expires_at" IS NOT NULL
            AND "effect_id" IS NULL AND "effect_attestation_json" IS NULL
            AND "acknowledged_at" IS NULL AND "terminal_reason" IS NOT NULL
            AND "handoff_id" IS NULL AND "runtime_admission_json" IS NULL
            AND "handoff_receipt_json" IS NULL AND "handoff_accepted_at" IS NULL)
        OR
        ("status" = 'cancelled' AND "current_attempt" = 0 AND "current_connector_id" IS NULL
            AND "current_claim_token_digest" IS NULL AND "current_lease_token_digest" IS NULL
            AND "lease_started_at" IS NULL AND "lease_expires_at" IS NULL
            AND "effect_id" IS NULL AND "effect_attestation_json" IS NULL
            AND "acknowledged_at" IS NULL AND "terminal_reason" IS NOT NULL
            AND "handoff_id" IS NULL AND "runtime_admission_json" IS NULL
            AND "handoff_receipt_json" IS NULL AND "handoff_accepted_at" IS NULL)
        OR
        ("status" = 'handed_off' AND "current_attempt" BETWEEN 1 AND 3 AND "current_connector_id" IS NOT NULL
            AND "current_claim_token_digest" IS NOT NULL AND "current_lease_token_digest" IS NOT NULL
            AND "lease_started_at" IS NOT NULL AND "lease_expires_at" IS NOT NULL
            AND "effect_id" IS NULL AND "effect_attestation_json" IS NULL
            AND "acknowledged_at" IS NULL AND "terminal_reason" IS NULL
            AND "handoff_id" IS NOT NULL AND "runtime_admission_json" IS NOT NULL
            AND "handoff_receipt_json" IS NOT NULL AND "handoff_accepted_at" IS NOT NULL)
    );

CREATE UNIQUE INDEX "cr2_standing_deliveries_handoff_id_key"
    ON "cr2_standing_deliveries"("handoff_id");

COMMIT;
