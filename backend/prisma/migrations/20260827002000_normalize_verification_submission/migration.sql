DROP TRIGGER "professional_verification_submission_ownership"
  ON "professional_verification_submissions";
DROP FUNCTION "validate_verification_submission_ownership"();

DROP INDEX "professional_verification_submissions_profile_submitted_idx";

ALTER TABLE "professional_verification_submissions"
  DROP CONSTRAINT "professional_verification_submissions_profile_fkey",
  DROP COLUMN "psychologist_profile_id";
