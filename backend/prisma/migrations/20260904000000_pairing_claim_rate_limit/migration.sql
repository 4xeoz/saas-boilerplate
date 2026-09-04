-- Amendment A: durable anonymous pairing-claim source budget.
-- The source digest is an HMAC of the trusted ingress identity. Raw client
-- addresses and the HMAC secret never enter this table.
CREATE TABLE "cr2_pairing_claim_rate_buckets" (
    "source_digest" TEXT NOT NULL,
    "window_started_at" TIMESTAMP(3) NOT NULL,
    "window_expires_at" TIMESTAMP(3) NOT NULL,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cr2_pairing_claim_rate_buckets_pkey"
        PRIMARY KEY ("source_digest", "window_started_at")
);

CREATE INDEX "cr2_pairing_claim_rate_buckets_window_expires_at_idx"
    ON "cr2_pairing_claim_rate_buckets"("window_expires_at");
