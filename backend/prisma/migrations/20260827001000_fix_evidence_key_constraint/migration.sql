ALTER TABLE "professional_verification_submissions"
  DROP CONSTRAINT "professional_verification_submissions_evidence_key_format";

ALTER TABLE "professional_verification_submissions"
  ADD CONSTRAINT "professional_verification_submissions_evidence_key_format"
  CHECK (
    length("evidence_object_key") BETWEEN 8 AND 512
    AND "evidence_object_key" ~ '^[A-Za-z0-9][A-Za-z0-9._/-]+$'
  );
