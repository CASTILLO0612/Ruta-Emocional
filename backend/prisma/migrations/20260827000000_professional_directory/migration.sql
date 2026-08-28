CREATE TYPE "verification_decision" AS ENUM ('APPROVED', 'REJECTED');

ALTER TABLE "specialties"
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "specialties_is_active_name_idx" ON "specialties"("is_active", "name");

ALTER TABLE "psychologist_modalities" ADD COLUMN "currency_code" CHAR(3);
UPDATE "psychologist_modalities" SET "currency_code" = 'NIO' WHERE "currency_code" IS NULL;
ALTER TABLE "psychologist_modalities" ALTER COLUMN "currency_code" SET NOT NULL;

ALTER TABLE "psychologist_modalities"
  ADD CONSTRAINT "psychologist_modalities_currency_code_format"
  CHECK ("currency_code" ~ '^[A-Z]{3}$');

CREATE TABLE "professional_verification_submissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "psychologist_profile_id" UUID NOT NULL,
  "professional_license_id" UUID NOT NULL,
  "evidence_object_key" VARCHAR(512) NOT NULL,
  "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "professional_verification_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_verification_submissions_profile_fkey"
    FOREIGN KEY ("psychologist_profile_id") REFERENCES "psychologist_profiles"("id") ON DELETE RESTRICT,
  CONSTRAINT "professional_verification_submissions_license_fkey"
    FOREIGN KEY ("professional_license_id") REFERENCES "professional_licenses"("id") ON DELETE RESTRICT,
  CONSTRAINT "professional_verification_submissions_evidence_key_format"
    CHECK ("evidence_object_key" ~ '^[A-Za-z0-9][A-Za-z0-9._/-]{7,511}$')
);

CREATE INDEX "professional_verification_submissions_profile_submitted_idx"
  ON "professional_verification_submissions"("psychologist_profile_id", "submitted_at");
CREATE INDEX "professional_verification_submissions_license_submitted_idx"
  ON "professional_verification_submissions"("professional_license_id", "submitted_at");
CREATE TABLE "professional_verification_decisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "submission_id" UUID NOT NULL,
  "reviewer_user_id" UUID NOT NULL,
  "decision" "verification_decision" NOT NULL,
  "public_reason" VARCHAR(500),
  "internal_reason" VARCHAR(1000),
  "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "professional_verification_decisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "professional_verification_decisions_submission_key" UNIQUE ("submission_id"),
  CONSTRAINT "professional_verification_decisions_submission_fkey"
    FOREIGN KEY ("submission_id") REFERENCES "professional_verification_submissions"("id") ON DELETE RESTRICT,
  CONSTRAINT "professional_verification_decisions_reviewer_fkey"
    FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "professional_verification_decisions_rejection_reason"
    CHECK ("decision" <> 'REJECTED' OR length(trim("public_reason")) >= 10)
);

CREATE INDEX "professional_verification_decisions_reviewer_decided_idx"
  ON "professional_verification_decisions"("reviewer_user_id", "decided_at");

CREATE OR REPLACE FUNCTION validate_verification_submission_ownership()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "professional_licenses" license
    WHERE license."id" = NEW."professional_license_id"
      AND license."psychologist_profile_id" = NEW."psychologist_profile_id"
  ) THEN
    RAISE EXCEPTION 'Verification submission profile and license do not match';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER professional_verification_submission_ownership
BEFORE INSERT ON "professional_verification_submissions"
FOR EACH ROW EXECUTE FUNCTION validate_verification_submission_ownership();

CREATE OR REPLACE FUNCTION prevent_professional_verification_history_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Professional verification history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER professional_verification_submissions_immutable
BEFORE UPDATE ON "professional_verification_submissions"
FOR EACH ROW EXECUTE FUNCTION prevent_professional_verification_history_update();

CREATE TRIGGER professional_verification_decisions_immutable
BEFORE UPDATE ON "professional_verification_decisions"
FOR EACH ROW EXECUTE FUNCTION prevent_professional_verification_history_update();

CREATE TRIGGER specialties_set_updated_at
BEFORE UPDATE ON "specialties"
FOR EACH ROW EXECUTE FUNCTION set_row_updated_at();
