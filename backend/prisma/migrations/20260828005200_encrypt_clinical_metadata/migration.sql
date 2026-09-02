ALTER TABLE "clinical_note_events"
    DROP CONSTRAINT "clinical_note_events_reason_check",
    DROP COLUMN "reason";

ALTER TABLE "clinical_note_versions"
    ALTER COLUMN "amendment_reason" TYPE TEXT;

ALTER TABLE "clinical_encounters"
    ALTER COLUMN "reason" TYPE TEXT;

ALTER TABLE "clinical_note_versions"
    ADD CONSTRAINT "clinical_note_versions_encrypted_amendment_reason_check"
    CHECK (
        "amendment_reason" IS NULL OR
        "amendment_reason" ~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    ) NOT VALID;

ALTER TABLE "clinical_encounters"
    ADD CONSTRAINT "clinical_encounters_encrypted_reason_check"
    CHECK (
        "reason" IS NULL OR
        "reason" ~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    ) NOT VALID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM "clinical_note_versions"
         WHERE "amendment_reason" IS NOT NULL
           AND "amendment_reason" !~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    ) THEN
        ALTER TABLE "clinical_note_versions"
            VALIDATE CONSTRAINT "clinical_note_versions_encrypted_amendment_reason_check";
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM "clinical_encounters"
         WHERE "reason" IS NOT NULL
           AND "reason" !~ '^v[1-9][0-9]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$'
    ) THEN
        ALTER TABLE "clinical_encounters"
            VALIDATE CONSTRAINT "clinical_encounters_encrypted_reason_check";
    END IF;
END;
$$;
