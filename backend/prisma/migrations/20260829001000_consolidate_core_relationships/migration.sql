CREATE TYPE "user_role_assignment_status" AS ENUM ('ACTIVE', 'ENDED');

ALTER TABLE "user_roles"
    ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN "status" "user_role_assignment_status" NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN "ended_at" TIMESTAMPTZ(3),
    DROP CONSTRAINT "user_roles_pkey",
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id"),
    ADD CONSTRAINT "user_roles_period_check" CHECK (
        ("status" = 'ACTIVE' AND "ended_at" IS NULL)
        OR ("status" = 'ENDED' AND "ended_at" IS NOT NULL AND "ended_at" >= "assigned_at")
    );

CREATE UNIQUE INDEX "user_roles_one_active_assignment_idx"
    ON "user_roles"("user_id", "role_id") WHERE "status" = 'ACTIVE';
CREATE INDEX "user_roles_user_id_status_idx" ON "user_roles"("user_id", "status");
CREATE INDEX "user_roles_role_id_status_idx" ON "user_roles"("role_id", "status");

CREATE FUNCTION protect_last_active_user_role()
RETURNS TRIGGER AS $$
DECLARE
    affected_user_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        affected_user_id := OLD."user_id";
    ELSE
        affected_user_id := NEW."user_id";
    END IF;

    IF EXISTS (SELECT 1 FROM "users" WHERE "id" = affected_user_id)
       AND NOT EXISTS (
           SELECT 1 FROM "user_roles"
            WHERE "user_id" = affected_user_id AND "status" = 'ACTIVE'
       ) THEN
        RAISE EXCEPTION 'An operational user must retain at least one active role'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "user_roles_keep_one_active"
AFTER UPDATE OR DELETE ON "user_roles"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION protect_last_active_user_role();

CREATE FUNCTION require_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "user_roles"
         WHERE "user_id" = NEW."id" AND "status" = 'ACTIVE'
    ) THEN
        RAISE EXCEPTION 'An operational user requires at least one active role'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "users_require_active_role"
AFTER INSERT ON "users"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION require_new_user_role();

CREATE FUNCTION validate_user_role_history()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."user_id" IS DISTINCT FROM NEW."user_id"
       OR OLD."role_id" IS DISTINCT FROM NEW."role_id"
       OR OLD."assigned_at" IS DISTINCT FROM NEW."assigned_at" THEN
        RAISE EXCEPTION 'A role assignment identity and start date are immutable'
            USING ERRCODE = '23514';
    END IF;

    IF OLD."status" = 'ENDED'
       AND (OLD."status" IS DISTINCT FROM NEW."status"
            OR OLD."ended_at" IS DISTINCT FROM NEW."ended_at") THEN
        RAISE EXCEPTION 'An ended role assignment is immutable; create a new assignment'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "user_roles_history_immutable"
BEFORE UPDATE ON "user_roles"
FOR EACH ROW EXECUTE FUNCTION validate_user_role_history();

CREATE TABLE "care_modalities" (
    "code" "modality" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(240),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "care_modalities_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "care_modalities_name_key" UNIQUE ("name")
);

INSERT INTO "care_modalities" ("code", "name", "description") VALUES
    ('CHAT', 'Chat seguro', 'Atención escrita dentro de la plataforma'),
    ('CALL', 'Atención remota', 'Atención sin ubicación física acordada'),
    ('IN_PERSON', 'Presencial', 'Atención en una ubicación acordada');

ALTER TABLE "psychologist_modalities"
    ADD CONSTRAINT "psychologist_modalities_modality_fkey"
    FOREIGN KEY ("modality") REFERENCES "care_modalities"("code")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_requests"
    ADD CONSTRAINT "service_requests_modality_fkey"
    FOREIGN KEY ("modality") REFERENCES "care_modalities"("code")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments"
    ADD CONSTRAINT "appointments_modality_fkey"
    FOREIGN KEY ("modality") REFERENCES "care_modalities"("code")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "triage_assessments"
    ADD CONSTRAINT "triage_assessments_recommended_modality_fkey"
    FOREIGN KEY ("recommended_modality") REFERENCES "care_modalities"("code")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "care_relationship_sources" ADD COLUMN "accepted_offer_id" UUID;

UPDATE "care_relationship_sources" source
   SET "accepted_offer_id" = accepted_offer."id"
  FROM "offers" accepted_offer
 WHERE accepted_offer."request_id" = source."service_request_id"
   AND accepted_offer."status" = 'ACCEPTED';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM "care_relationship_sources" WHERE "accepted_offer_id" IS NULL
    ) THEN
        RAISE EXCEPTION 'Cannot consolidate a care relationship without an accepted offer';
    END IF;
END;
$$;

ALTER TABLE "conversations" ADD COLUMN "care_relationship_id" UUID;

UPDATE "conversations" conversation
   SET "care_relationship_id" = source."care_relationship_id"
  FROM "request_conversations" request_link
  JOIN "care_relationship_sources" source
    ON source."service_request_id" = request_link."service_request_id"
 WHERE request_link."conversation_id" = conversation."id";

UPDATE "conversations" conversation
   SET "care_relationship_id" = appointment_link."care_relationship_id"
  FROM "appointment_conversations" conversation_link
  JOIN "appointment_care_relationships" appointment_link
    ON appointment_link."appointment_id" = conversation_link."appointment_id"
 WHERE conversation_link."conversation_id" = conversation."id"
   AND conversation."care_relationship_id" IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "conversations" WHERE "care_relationship_id" IS NULL) THEN
        RAISE EXCEPTION 'Cannot consolidate a conversation without a care relationship';
    END IF;
    IF EXISTS (
        SELECT "care_relationship_id"
          FROM "conversations"
         GROUP BY "care_relationship_id"
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'A care relationship has more than one conversation and requires manual reconciliation';
    END IF;
END;
$$;

ALTER TABLE "appointments" ADD COLUMN "care_relationship_id" UUID;

UPDATE "appointments" appointment
   SET "care_relationship_id" = relationship_link."care_relationship_id"
  FROM "appointment_care_relationships" relationship_link
 WHERE relationship_link."appointment_id" = appointment."id";

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "appointments" WHERE "care_relationship_id" IS NULL) THEN
        RAISE EXCEPTION 'Cannot consolidate an appointment without a care relationship';
    END IF;
    IF EXISTS (SELECT 1 FROM "clinical_encounters" WHERE "care_relationship_id" IS NULL) THEN
        RAISE EXCEPTION 'Cannot enforce clinical ownership while encounters without a care relationship exist';
    END IF;
END;
$$;

ALTER TABLE "treatment_plans" ADD COLUMN "care_relationship_id" UUID;

UPDATE "treatment_plans" plan
   SET "care_relationship_id" = (
       SELECT relationship."id"
         FROM "care_relationships" relationship
         JOIN "clinical_records" record
           ON record."patient_profile_id" = relationship."patient_profile_id"
        WHERE record."id" = plan."clinical_record_id"
          AND relationship."psychologist_profile_id" = plan."psychologist_profile_id"
          AND relationship."started_at" <= plan."starts_at"
          AND (relationship."ended_at" IS NULL OR relationship."ended_at" >= plan."starts_at")
        ORDER BY relationship."started_at" DESC, relationship."id" DESC
        LIMIT 1
   );

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "treatment_plans" WHERE "care_relationship_id" IS NULL) THEN
        RAISE EXCEPTION 'Cannot consolidate a treatment plan without an attributable care relationship';
    END IF;
END;
$$;

ALTER TYPE "consent_decision" ADD VALUE IF NOT EXISTS 'REJECTED' BEFORE 'WITHDRAWN';
ALTER TABLE "patient_consents" ADD COLUMN "care_relationship_id" UUID;
ALTER TABLE "clinical_diagnoses" ADD COLUMN "care_relationship_id" UUID;

DROP TRIGGER IF EXISTS "care_relationship_sources_match_request" ON "care_relationship_sources";
DROP FUNCTION IF EXISTS validate_care_relationship_source();
DROP TRIGGER IF EXISTS "appointment_requests_match_participants" ON "appointment_requests";
DROP FUNCTION IF EXISTS validate_appointment_request();
DROP TRIGGER IF EXISTS "appointment_care_relationships_match_participants" ON "appointment_care_relationships";
DROP FUNCTION IF EXISTS validate_appointment_care_relationship();

DROP TABLE "request_conversations";
DROP TABLE "appointment_conversations";
DROP TABLE "appointment_requests";
DROP TABLE "appointment_care_relationships";

DROP INDEX "care_relationship_sources_service_request_id_key";
ALTER TABLE "care_relationship_sources"
    DROP CONSTRAINT "care_relationship_sources_service_request_id_fkey",
    DROP COLUMN "service_request_id",
    ALTER COLUMN "accepted_offer_id" SET NOT NULL,
    ADD CONSTRAINT "care_relationship_sources_accepted_offer_id_fkey"
      FOREIGN KEY ("accepted_offer_id") REFERENCES "offers"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "care_relationship_sources_accepted_offer_id_key"
    ON "care_relationship_sources"("accepted_offer_id");

ALTER TABLE "conversations"
    ALTER COLUMN "care_relationship_id" SET NOT NULL,
    ADD CONSTRAINT "conversations_care_relationship_id_fkey"
      FOREIGN KEY ("care_relationship_id") REFERENCES "care_relationships"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "conversations_care_relationship_id_key"
    ON "conversations"("care_relationship_id");

ALTER TABLE "appointments"
    ALTER COLUMN "care_relationship_id" SET NOT NULL,
    ADD CONSTRAINT "appointments_care_relationship_id_fkey"
      FOREIGN KEY ("care_relationship_id") REFERENCES "care_relationships"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "appointments_care_relationship_id_starts_at_idx"
    ON "appointments"("care_relationship_id", "starts_at");

ALTER TABLE "clinical_encounters" ALTER COLUMN "care_relationship_id" SET NOT NULL;

DROP INDEX "treatment_plans_one_open_per_professional_record_idx";
DROP INDEX "treatment_plans_clinical_record_id_status_idx";
ALTER TABLE "treatment_plans"
    ALTER COLUMN "care_relationship_id" SET NOT NULL,
    ADD CONSTRAINT "treatment_plans_care_relationship_id_fkey"
      FOREIGN KEY ("care_relationship_id") REFERENCES "care_relationships"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "treatment_plans_care_relationship_id_status_idx"
    ON "treatment_plans"("care_relationship_id", "status");
CREATE UNIQUE INDEX "treatment_plans_one_open_per_relationship_idx"
    ON "treatment_plans"("care_relationship_id")
    WHERE "status" IN ('DRAFT', 'ACTIVE');

ALTER TABLE "patient_consents"
    ADD CONSTRAINT "patient_consents_care_relationship_id_fkey"
      FOREIGN KEY ("care_relationship_id") REFERENCES "care_relationships"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "patient_consents_care_relationship_id_occurred_at_idx"
    ON "patient_consents"("care_relationship_id", "occurred_at");

ALTER TABLE "clinical_diagnoses"
    ADD CONSTRAINT "clinical_diagnoses_care_relationship_id_fkey"
      FOREIGN KEY ("care_relationship_id") REFERENCES "care_relationships"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "clinical_diagnoses_care_relationship_id_diagnosed_at_idx"
    ON "clinical_diagnoses"("care_relationship_id", "diagnosed_at");

CREATE FUNCTION validate_care_relationship_source_offer()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM "care_relationships" relationship
          JOIN "offers" accepted_offer ON accepted_offer."id" = NEW."accepted_offer_id"
          JOIN "service_requests" request ON request."id" = accepted_offer."request_id"
         WHERE relationship."id" = NEW."care_relationship_id"
           AND accepted_offer."status" = 'ACCEPTED'
           AND request."status" = 'ACCEPTED'
           AND relationship."patient_profile_id" = request."patient_profile_id"
           AND relationship."psychologist_profile_id" = accepted_offer."psychologist_profile_id"
    ) THEN
        RAISE EXCEPTION 'Care relationship does not match its accepted offer'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "care_relationship_sources_match_offer"
AFTER INSERT OR UPDATE ON "care_relationship_sources"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_care_relationship_source_offer();

CREATE FUNCTION validate_appointment_relationship()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "care_relationships" relationship
         WHERE relationship."id" = NEW."care_relationship_id"
           AND relationship."patient_profile_id" = NEW."patient_profile_id"
           AND relationship."psychologist_profile_id" = NEW."psychologist_profile_id"
    ) THEN
        RAISE EXCEPTION 'Appointment participants do not match the care relationship'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "appointments_match_relationship"
AFTER INSERT OR UPDATE ON "appointments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_appointment_relationship();

CREATE FUNCTION validate_longitudinal_conversation_membership()
RETURNS TRIGGER AS $$
DECLARE
    target_conversation_id UUID;
    expected_members INTEGER;
    total_members INTEGER;
BEGIN
    IF TG_TABLE_NAME = 'conversations' THEN
        IF TG_OP = 'DELETE' THEN
            target_conversation_id := OLD."id";
        ELSE
            target_conversation_id := NEW."id";
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        target_conversation_id := OLD."conversation_id";
    ELSE
        target_conversation_id := NEW."conversation_id";
    END IF;

    IF NOT EXISTS (SELECT 1 FROM "conversations" WHERE "id" = target_conversation_id) THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;
        RETURN NEW;
    END IF;

    SELECT
        count(*) FILTER (
            WHERE participant."user_id" IN (patient."user_id", psychologist."user_id")
        ),
        count(participant."id")
      INTO expected_members, total_members
      FROM "conversations" conversation
      JOIN "care_relationships" relationship
        ON relationship."id" = conversation."care_relationship_id"
      JOIN "patient_profiles" patient ON patient."id" = relationship."patient_profile_id"
      JOIN "psychologist_profiles" psychologist
        ON psychologist."id" = relationship."psychologist_profile_id"
      LEFT JOIN "conversation_participants" participant
        ON participant."conversation_id" = conversation."id"
     WHERE conversation."id" = target_conversation_id;

    IF total_members <> 2 OR expected_members <> 2 THEN
        RAISE EXCEPTION 'A longitudinal conversation requires exactly its patient and psychologist'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "conversations_complete_membership"
AFTER INSERT OR UPDATE ON "conversations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_longitudinal_conversation_membership();
CREATE CONSTRAINT TRIGGER "conversation_participants_complete_membership"
AFTER INSERT OR UPDATE OR DELETE ON "conversation_participants"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_longitudinal_conversation_membership();

CREATE FUNCTION validate_treatment_plan_relationship()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM "care_relationships" relationship
          JOIN "clinical_records" record
            ON record."patient_profile_id" = relationship."patient_profile_id"
         WHERE relationship."id" = NEW."care_relationship_id"
           AND record."id" = NEW."clinical_record_id"
           AND relationship."psychologist_profile_id" = NEW."psychologist_profile_id"
    ) THEN
        RAISE EXCEPTION 'Treatment plan does not match its care relationship'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "treatment_plans_match_relationship"
AFTER INSERT OR UPDATE ON "treatment_plans"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_treatment_plan_relationship();

CREATE FUNCTION validate_consent_relationship()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."care_relationship_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM "care_relationships" relationship
         WHERE relationship."id" = NEW."care_relationship_id"
           AND relationship."patient_profile_id" = NEW."patient_profile_id"
    ) THEN
        RAISE EXCEPTION 'Consent context does not belong to the patient'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "patient_consents_match_relationship"
AFTER INSERT OR UPDATE ON "patient_consents"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_consent_relationship();

CREATE FUNCTION validate_diagnosis_relationship()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW."care_relationship_id" IS NOT NULL AND NOT EXISTS (
        SELECT 1
          FROM "care_relationships" relationship
          JOIN "clinical_records" record
            ON record."patient_profile_id" = relationship."patient_profile_id"
         WHERE relationship."id" = NEW."care_relationship_id"
           AND record."id" = NEW."clinical_record_id"
           AND relationship."psychologist_profile_id" = NEW."psychologist_profile_id"
    ) THEN
        RAISE EXCEPTION 'Diagnosis does not match its care relationship'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "clinical_diagnoses_match_relationship"
AFTER INSERT OR UPDATE ON "clinical_diagnoses"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_diagnosis_relationship();

DROP TRIGGER "appointments_participants_immutable" ON "appointments";
CREATE TRIGGER "appointments_identity_immutable"
BEFORE UPDATE OF "patient_profile_id", "psychologist_profile_id", "care_relationship_id"
ON "appointments"
FOR EACH ROW WHEN (
    OLD."patient_profile_id" IS DISTINCT FROM NEW."patient_profile_id"
    OR OLD."psychologist_profile_id" IS DISTINCT FROM NEW."psychologist_profile_id"
    OR OLD."care_relationship_id" IS DISTINCT FROM NEW."care_relationship_id"
)
EXECUTE FUNCTION reject_immutable_relationship_change();

DROP TRIGGER "clinical_encounters_identity_immutable" ON "clinical_encounters";
CREATE TRIGGER "clinical_encounters_identity_immutable"
BEFORE UPDATE OF "clinical_record_id", "psychologist_profile_id", "care_relationship_id"
ON "clinical_encounters"
FOR EACH ROW WHEN (
    OLD."clinical_record_id" IS DISTINCT FROM NEW."clinical_record_id"
    OR OLD."psychologist_profile_id" IS DISTINCT FROM NEW."psychologist_profile_id"
    OR OLD."care_relationship_id" IS DISTINCT FROM NEW."care_relationship_id"
)
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE TRIGGER "care_relationship_sources_identity_immutable"
BEFORE UPDATE OF "care_relationship_id", "accepted_offer_id" ON "care_relationship_sources"
FOR EACH ROW WHEN (
    OLD."care_relationship_id" IS DISTINCT FROM NEW."care_relationship_id"
    OR OLD."accepted_offer_id" IS DISTINCT FROM NEW."accepted_offer_id"
)
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE TRIGGER "conversations_relationship_immutable"
BEFORE UPDATE OF "care_relationship_id" ON "conversations"
FOR EACH ROW WHEN (OLD."care_relationship_id" IS DISTINCT FROM NEW."care_relationship_id")
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE TRIGGER "treatment_plans_identity_immutable"
BEFORE UPDATE OF "clinical_record_id", "psychologist_profile_id", "care_relationship_id"
ON "treatment_plans"
FOR EACH ROW WHEN (
    OLD."clinical_record_id" IS DISTINCT FROM NEW."clinical_record_id"
    OR OLD."psychologist_profile_id" IS DISTINCT FROM NEW."psychologist_profile_id"
    OR OLD."care_relationship_id" IS DISTINCT FROM NEW."care_relationship_id"
)
EXECUTE FUNCTION reject_immutable_relationship_change();

DROP TRIGGER "clinical_diagnoses_identity_immutable" ON "clinical_diagnoses";
CREATE TRIGGER "clinical_diagnoses_identity_immutable"
BEFORE UPDATE OF "clinical_record_id", "psychologist_profile_id", "care_relationship_id"
ON "clinical_diagnoses"
FOR EACH ROW WHEN (
    OLD."clinical_record_id" IS DISTINCT FROM NEW."clinical_record_id"
    OR OLD."psychologist_profile_id" IS DISTINCT FROM NEW."psychologist_profile_id"
    OR OLD."care_relationship_id" IS DISTINCT FROM NEW."care_relationship_id"
)
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE OR REPLACE FUNCTION validate_clinical_encounter_appointment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM "clinical_encounters" encounter
          JOIN "clinical_records" record ON record."id" = encounter."clinical_record_id"
          JOIN "appointments" appointment ON appointment."id" = NEW."appointment_id"
         WHERE encounter."id" = NEW."clinical_encounter_id"
           AND record."patient_profile_id" = appointment."patient_profile_id"
           AND encounter."psychologist_profile_id" = appointment."psychologist_profile_id"
           AND encounter."care_relationship_id" = appointment."care_relationship_id"
    ) THEN
        RAISE EXCEPTION 'Clinical encounter does not match the appointment care relationship'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
