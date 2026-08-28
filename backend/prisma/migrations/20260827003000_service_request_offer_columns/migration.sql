ALTER TYPE "request_status" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "service_requests"
  ADD COLUMN "currency_code" CHAR(3),
  ADD COLUMN "scheduled_for" TIMESTAMPTZ(3),
  ADD COLUMN "expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "location_expires_at" TIMESTAMPTZ(3);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "service_requests"
    WHERE "currency_code" IS NULL OR "expires_at" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Existing service requests require an explicit currency and expiration ETL before this migration';
  END IF;
END;
$$;

ALTER TABLE "service_requests"
  ALTER COLUMN "currency_code" SET NOT NULL,
  ALTER COLUMN "expires_at" SET NOT NULL;

DROP INDEX "service_requests_status_created_at_idx";
CREATE INDEX "service_requests_status_expires_at_created_at_idx"
  ON "service_requests"("status", "expires_at", "created_at");
CREATE INDEX "service_requests_scheduled_for_status_idx"
  ON "service_requests"("scheduled_for", "status");

CREATE TABLE "idempotency_records" (
  "actor_user_id" UUID NOT NULL,
  "operation" VARCHAR(80) NOT NULL,
  "idempotency_key" UUID NOT NULL,
  "request_hash" CHAR(64) NOT NULL,
  "resource_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "idempotency_records_pkey"
    PRIMARY KEY ("actor_user_id", "operation", "idempotency_key"),
  CONSTRAINT "idempotency_records_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "idempotency_records_hash_format"
    CHECK ("request_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "idempotency_records_expiry_after_creation"
    CHECK ("expires_at" > "created_at")
);

CREATE INDEX "idempotency_records_expires_at_idx"
  ON "idempotency_records"("expires_at");
