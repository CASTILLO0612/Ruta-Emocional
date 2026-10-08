CREATE TYPE "push_platform" AS ENUM ('ANDROID', 'IOS');

CREATE TYPE "push_delivery_status" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'DELIVERED',
  'FAILED',
  'SKIPPED'
);

CREATE TABLE "push_devices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "installation_id" UUID NOT NULL,
  "expo_push_token" VARCHAR(255) NOT NULL,
  "platform" "push_platform" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_devices_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "push_devices_expo_push_token_key"
  ON "push_devices"("expo_push_token");
CREATE UNIQUE INDEX "push_devices_user_id_installation_id_key"
  ON "push_devices"("user_id", "installation_id");
CREATE INDEX "push_devices_user_id_active_idx"
  ON "push_devices"("user_id", "active");

CREATE TABLE "push_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "outbox_event_id" UUID NOT NULL,
  "push_device_id" UUID NOT NULL,
  "notification_type" VARCHAR(80) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "body" VARCHAR(240) NOT NULL,
  "data" JSONB NOT NULL,
  "status" "push_delivery_status" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_at" TIMESTAMPTZ(3),
  "claim_token" UUID,
  "provider_ticket_id" VARCHAR(120),
  "receipt_checked_at" TIMESTAMPTZ(3),
  "last_error_code" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_deliveries_push_device_id_fkey"
    FOREIGN KEY ("push_device_id") REFERENCES "push_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "push_deliveries_outbox_event_id_push_device_id_key"
  ON "push_deliveries"("outbox_event_id", "push_device_id");
CREATE INDEX "push_deliveries_status_available_at_created_at_idx"
  ON "push_deliveries"("status", "available_at", "created_at");
CREATE INDEX "push_deliveries_provider_ticket_id_status_idx"
  ON "push_deliveries"("provider_ticket_id", "status");
