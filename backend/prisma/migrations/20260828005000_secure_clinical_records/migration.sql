CREATE TYPE "clinical_note_event_type" AS ENUM (
    'CREATED',
    'DRAFT_UPDATED',
    'SIGNED',
    'AMENDED'
);

ALTER TABLE "clinical_encounters"
    ADD COLUMN "care_relationship_id" UUID,
    ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "clinical_notes"
    ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "treatment_plans"
    ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "clinical_note_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clinical_note_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "type" "clinical_note_event_type" NOT NULL,
    "from_status" "clinical_note_status",
    "to_status" "clinical_note_status" NOT NULL,
    "version_number" INTEGER NOT NULL,
    "reason" VARCHAR(500),
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "clinical_note_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "clinical_note_events_version_positive_check" CHECK ("version_number" > 0),
    CONSTRAINT "clinical_note_events_state_check" CHECK (
        ("type" = 'CREATED' AND "from_status" IS NULL AND "to_status" = 'DRAFT') OR
        ("type" = 'DRAFT_UPDATED' AND "from_status" = 'DRAFT' AND "to_status" = 'DRAFT') OR
        ("type" = 'SIGNED' AND "from_status" = 'DRAFT' AND "to_status" = 'SIGNED') OR
        ("type" = 'AMENDED' AND "from_status" IN ('SIGNED', 'AMENDED') AND "to_status" = 'AMENDED')
    ),
    CONSTRAINT "clinical_note_events_reason_check" CHECK (
        ("type" = 'AMENDED' AND length(btrim("reason")) >= 10) OR
        ("type" <> 'AMENDED' AND "reason" IS NULL)
    )
);

CREATE INDEX "clinical_note_events_clinical_note_id_occurred_at_id_idx"
    ON "clinical_note_events"("clinical_note_id", "occurred_at", "id");
CREATE INDEX "clinical_note_events_actor_user_id_occurred_at_idx"
    ON "clinical_note_events"("actor_user_id", "occurred_at");
CREATE INDEX "clinical_encounters_care_relationship_id_started_at_idx"
    ON "clinical_encounters"("care_relationship_id", "started_at");
CREATE INDEX "clinical_encounters_psychologist_profile_id_started_at_idx"
    ON "clinical_encounters"("psychologist_profile_id", "started_at");

ALTER TABLE "clinical_encounters"
    ADD CONSTRAINT "clinical_encounters_care_relationship_id_fkey"
    FOREIGN KEY ("care_relationship_id") REFERENCES "care_relationships"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "clinical_encounters_relationship_required_check"
    CHECK ("care_relationship_id" IS NOT NULL) NOT VALID;

ALTER TABLE "clinical_note_events"
    ADD CONSTRAINT "clinical_note_events_clinical_note_id_fkey"
    FOREIGN KEY ("clinical_note_id") REFERENCES "clinical_notes"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "clinical_note_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "clinical_note_versions"
    ADD CONSTRAINT "clinical_note_versions_encrypted_content_check"
    CHECK ("content" ~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') NOT VALID;

ALTER TABLE "treatment_plans"
    ADD CONSTRAINT "treatment_plans_encrypted_summary_check"
    CHECK ("summary" IS NULL OR "summary" ~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') NOT VALID;

ALTER TABLE "treatment_goals"
    ADD CONSTRAINT "treatment_goals_encrypted_description_check"
    CHECK ("description" ~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') NOT VALID;

CREATE FUNCTION validate_clinical_encounter_relationship()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM "care_relationships" relationship
          JOIN "clinical_records" record
            ON record."patient_profile_id" = relationship."patient_profile_id"
         WHERE relationship."id" = NEW."care_relationship_id"
           AND relationship."psychologist_profile_id" = NEW."psychologist_profile_id"
           AND record."id" = NEW."clinical_record_id"
    ) THEN
        RAISE EXCEPTION 'clinical encounter relationship participants do not match'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "clinical_encounters_match_relationship"
AFTER INSERT OR UPDATE OF "care_relationship_id", "clinical_record_id", "psychologist_profile_id"
ON "clinical_encounters"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_clinical_encounter_relationship();

CREATE FUNCTION reject_clinical_append_only_change()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'clinical append-only data cannot be modified or deleted'
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "clinical_note_versions_append_only"
BEFORE UPDATE OR DELETE ON "clinical_note_versions"
FOR EACH ROW EXECUTE FUNCTION reject_clinical_append_only_change();

CREATE TRIGGER "clinical_note_events_append_only"
BEFORE UPDATE OR DELETE ON "clinical_note_events"
FOR EACH ROW EXECUTE FUNCTION reject_clinical_append_only_change();

CREATE FUNCTION validate_clinical_note_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."clinical_encounter_id" IS DISTINCT FROM NEW."clinical_encounter_id" THEN
        RAISE EXCEPTION 'clinical note encounter cannot be changed' USING ERRCODE = '23514';
    END IF;
    IF OLD."signed_at" IS NOT NULL AND OLD."signed_at" IS DISTINCT FROM NEW."signed_at" THEN
        RAISE EXCEPTION 'clinical note signature timestamp is immutable' USING ERRCODE = '23514';
    END IF;
    IF NOT (
        (OLD."status" = 'DRAFT' AND NEW."status" IN ('DRAFT', 'SIGNED')) OR
        (OLD."status" = 'SIGNED' AND NEW."status" IN ('SIGNED', 'AMENDED')) OR
        (OLD."status" = 'AMENDED' AND NEW."status" = 'AMENDED')
    ) THEN
        RAISE EXCEPTION 'invalid clinical note transition' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "clinical_notes_guard_transition"
BEFORE UPDATE ON "clinical_notes"
FOR EACH ROW EXECUTE FUNCTION validate_clinical_note_transition();

CREATE UNIQUE INDEX "treatment_plans_one_open_per_professional_record_idx"
    ON "treatment_plans"("clinical_record_id", "psychologist_profile_id")
    WHERE "status" IN ('DRAFT', 'ACTIVE');
