CREATE TYPE "menta_conversation_scope" AS ENUM ('PATIENT', 'PSYCHOLOGIST');
CREATE TYPE "menta_turn_status" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "menta_provider_outcome" AS ENUM ('NOT_USED', 'SUCCEEDED', 'UNAVAILABLE', 'REJECTED_OUTPUT');
CREATE TYPE "menta_tool_outcome" AS ENUM ('SUCCEEDED', 'DENIED', 'FAILED');

CREATE TABLE "menta_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "scope" "menta_conversation_scope" NOT NULL,
  "consent_version" VARCHAR(30) NOT NULL,
  "consented_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "menta_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menta_conversations_user_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "menta_conversations_consent_version_nonempty"
    CHECK (length(btrim("consent_version")) > 0),
  CONSTRAINT "menta_conversations_close_order"
    CHECK ("closed_at" IS NULL OR "closed_at" >= "created_at")
);

CREATE UNIQUE INDEX "menta_conversations_one_open_scope_key"
  ON "menta_conversations" ("user_id", "scope")
  WHERE "closed_at" IS NULL;
CREATE INDEX "menta_conversations_user_scope_updated_idx"
  ON "menta_conversations" ("user_id", "scope", "updated_at");

CREATE TRIGGER menta_conversations_set_updated_at
BEFORE UPDATE ON "menta_conversations"
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();

CREATE TABLE "menta_turns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "client_message_id" UUID NOT NULL,
  "user_content_encrypted" TEXT NOT NULL,
  "assistant_content_encrypted" TEXT,
  "status" "menta_turn_status" NOT NULL DEFAULT 'PROCESSING',
  "provider_outcome" "menta_provider_outcome" NOT NULL DEFAULT 'NOT_USED',
  "model_name" VARCHAR(120),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ(3),
  CONSTRAINT "menta_turns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menta_turns_conversation_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "menta_conversations"("id") ON DELETE RESTRICT,
  CONSTRAINT "menta_turns_client_message_key" UNIQUE ("conversation_id", "client_message_id"),
  CONSTRAINT "menta_turns_user_content_nonempty"
    CHECK (length("user_content_encrypted") > 0),
  CONSTRAINT "menta_turns_completion_shape"
    CHECK (
      ("status" = 'PROCESSING' AND "assistant_content_encrypted" IS NULL AND "completed_at" IS NULL)
      OR
      ("status" = 'COMPLETED' AND "assistant_content_encrypted" IS NOT NULL AND "completed_at" IS NOT NULL)
      OR
      ("status" = 'FAILED' AND "assistant_content_encrypted" IS NULL AND "completed_at" IS NOT NULL)
    ),
  CONSTRAINT "menta_turns_model_provider_consistency"
    CHECK (
      ("provider_outcome" = 'SUCCEEDED' AND "model_name" IS NOT NULL)
      OR
      ("provider_outcome" <> 'SUCCEEDED' AND "model_name" IS NULL)
    )
);

CREATE INDEX "menta_turns_conversation_created_idx"
  ON "menta_turns" ("conversation_id", "created_at", "id");

CREATE TABLE "menta_tool_invocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "turn_id" UUID NOT NULL,
  "tool_code" VARCHAR(80) NOT NULL,
  "outcome" "menta_tool_outcome" NOT NULL,
  "resource_type" VARCHAR(80),
  "resource_count" SMALLINT,
  "invoked_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "menta_tool_invocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "menta_tool_invocations_turn_fkey"
    FOREIGN KEY ("turn_id") REFERENCES "menta_turns"("id") ON DELETE RESTRICT,
  CONSTRAINT "menta_tool_invocations_code_nonempty"
    CHECK (length(btrim("tool_code")) > 0),
  CONSTRAINT "menta_tool_invocations_resource_count_nonnegative"
    CHECK ("resource_count" IS NULL OR "resource_count" >= 0)
);

CREATE INDEX "menta_tool_invocations_turn_invoked_idx"
  ON "menta_tool_invocations" ("turn_id", "invoked_at");
