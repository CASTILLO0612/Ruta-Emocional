CREATE TYPE "call_media_type" AS ENUM ('AUDIO', 'VIDEO');

CREATE TYPE "call_session_status" AS ENUM (
  'RINGING',
  'ACTIVE',
  'ENDED',
  'DECLINED',
  'MISSED'
);

CREATE TABLE "call_sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "initiator_user_id" UUID NOT NULL,
  "media_type" "call_media_type" NOT NULL,
  "status" "call_session_status" NOT NULL DEFAULT 'RINGING',
  "room_name" VARCHAR(100) NOT NULL,
  "accepted_at" TIMESTAMPTZ(3),
  "ended_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_sessions_conversation_id_fkey"
    FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "call_sessions_initiator_user_id_fkey"
    FOREIGN KEY ("initiator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "call_sessions_room_name_key" UNIQUE ("room_name")
);

CREATE INDEX "call_sessions_conversation_id_created_at_idx"
  ON "call_sessions"("conversation_id", "created_at");
CREATE INDEX "call_sessions_status_expires_at_idx"
  ON "call_sessions"("status", "expires_at");
CREATE UNIQUE INDEX "call_sessions_one_open_per_conversation_key"
  ON "call_sessions"("conversation_id")
  WHERE "status" IN ('RINGING', 'ACTIVE');
