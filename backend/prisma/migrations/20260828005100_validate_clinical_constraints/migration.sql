ALTER TABLE "treatment_plans"
    ADD CONSTRAINT "treatment_plans_summary_required_check"
    CHECK ("summary" IS NOT NULL) NOT VALID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "clinical_encounters" WHERE "care_relationship_id" IS NULL
    ) THEN
        ALTER TABLE "clinical_encounters"
            VALIDATE CONSTRAINT "clinical_encounters_relationship_required_check";
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM "clinical_note_versions"
         WHERE "content" !~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    ) THEN
        ALTER TABLE "clinical_note_versions"
            VALIDATE CONSTRAINT "clinical_note_versions_encrypted_content_check";
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM "treatment_plans"
         WHERE "summary" IS NULL
            OR "summary" !~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    ) THEN
        ALTER TABLE "treatment_plans"
            VALIDATE CONSTRAINT "treatment_plans_summary_required_check";
        ALTER TABLE "treatment_plans"
            VALIDATE CONSTRAINT "treatment_plans_encrypted_summary_check";
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM "treatment_goals"
         WHERE "description" !~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    ) THEN
        ALTER TABLE "treatment_goals"
            VALIDATE CONSTRAINT "treatment_goals_encrypted_description_check";
    END IF;
END;
$$;
