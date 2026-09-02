ALTER TABLE "messages"
  ADD COLUMN "client_message_id" UUID;

UPDATE "messages"
   SET "client_message_id" = gen_random_uuid()
 WHERE "client_message_id" IS NULL;

ALTER TABLE "messages"
  ALTER COLUMN "client_message_id" SET NOT NULL,
  ADD CONSTRAINT "messages_content_length"
    CHECK (char_length("content") BETWEEN 1 AND 4000);

DROP INDEX "messages_conversation_participant_id_sent_at_idx";
CREATE UNIQUE INDEX "messages_conversation_participant_id_client_message_id_key"
  ON "messages"("conversation_participant_id", "client_message_id");
CREATE INDEX "messages_conversation_participant_id_sent_at_id_idx"
  ON "messages"("conversation_participant_id", "sent_at", "id");

ALTER TABLE "outbox_events"
  ADD COLUMN "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "claimed_at" TIMESTAMPTZ(3),
  ADD COLUMN "claim_token" UUID,
  ADD COLUMN "dead_lettered_at" TIMESTAMPTZ(3),
  ADD CONSTRAINT "outbox_events_claim_consistency"
    CHECK (("claimed_at" IS NULL) = ("claim_token" IS NULL)),
  ADD CONSTRAINT "outbox_events_attempts_nonnegative"
    CHECK ("attempts" >= 0);

DROP INDEX "outbox_events_published_at_occurred_at_idx";
CREATE INDEX "outbox_events_delivery_idx"
  ON "outbox_events"("published_at", "dead_lettered_at", "available_at", "occurred_at");

CREATE TEMPORARY TABLE "messaging_backfill" (
  "conversation_id" UUID PRIMARY KEY,
  "service_request_id" UUID NOT NULL UNIQUE,
  "patient_user_id" UUID NOT NULL,
  "psychologist_user_id" UUID NOT NULL
) ON COMMIT DROP;

INSERT INTO "messaging_backfill" (
  "conversation_id",
  "service_request_id",
  "patient_user_id",
  "psychologist_user_id"
)
SELECT
  gen_random_uuid(),
  source."service_request_id",
  patient."user_id",
  psychologist."user_id"
FROM "care_relationship_sources" source
JOIN "care_relationships" relationship
  ON relationship."id" = source."care_relationship_id"
JOIN "patient_profiles" patient
  ON patient."id" = relationship."patient_profile_id"
JOIN "psychologist_profiles" psychologist
  ON psychologist."id" = relationship."psychologist_profile_id"
LEFT JOIN "request_conversations" existing
  ON existing."service_request_id" = source."service_request_id"
WHERE existing."service_request_id" IS NULL;

INSERT INTO "conversations" ("id")
SELECT "conversation_id" FROM "messaging_backfill";

INSERT INTO "request_conversations" ("conversation_id", "service_request_id")
SELECT "conversation_id", "service_request_id" FROM "messaging_backfill";

INSERT INTO "conversation_participants" ("conversation_id", "user_id")
SELECT "conversation_id", "patient_user_id" FROM "messaging_backfill"
UNION ALL
SELECT "conversation_id", "psychologist_user_id" FROM "messaging_backfill";
