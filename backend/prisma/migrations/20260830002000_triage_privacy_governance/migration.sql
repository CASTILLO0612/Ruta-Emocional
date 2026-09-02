-- Phase 8 production gate: consent withdrawal and erasure-request governance.
-- Historical consent and assessments remain immutable; an erasure request blocks
-- new processing until an authorized privacy reviewer resolves applicable duties.

CREATE TYPE "triage_erasure_request_status" AS ENUM (
    'BLOCKED',
    'UNDER_REVIEW',
    'RESOLVED',
    'DENIED'
);

CREATE TABLE "triage_consent_withdrawals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "triage_assessment_id" UUID NOT NULL,
    "patient_profile_id" UUID NOT NULL,
    "withdrawal_decision_id" UUID NOT NULL,
    "withdrawn_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "triage_consent_withdrawals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "triage_consent_withdrawals_triage_assessment_id_key" UNIQUE ("triage_assessment_id"),
    CONSTRAINT "triage_consent_withdrawals_withdrawal_decision_id_key" UNIQUE ("withdrawal_decision_id"),
    CONSTRAINT "triage_consent_withdrawals_triage_assessment_id_fkey"
      FOREIGN KEY ("triage_assessment_id") REFERENCES "triage_assessments"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "triage_consent_withdrawals_patient_profile_id_fkey"
      FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "triage_consent_withdrawals_withdrawal_decision_id_fkey"
      FOREIGN KEY ("withdrawal_decision_id") REFERENCES "patient_consents"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "triage_consent_withdrawals_patient_profile_id_withdrawn_at_idx"
    ON "triage_consent_withdrawals"("patient_profile_id", "withdrawn_at");

CREATE TABLE "triage_erasure_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "triage_assessment_id" UUID NOT NULL,
    "patient_profile_id" UUID NOT NULL,
    "status" "triage_erasure_request_status" NOT NULL DEFAULT 'BLOCKED',
    "policy_version" VARCHAR(80) NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by_user_id" UUID,
    "resolution_code" VARCHAR(80),
    CONSTRAINT "triage_erasure_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "triage_erasure_requests_triage_assessment_id_key" UNIQUE ("triage_assessment_id"),
    CONSTRAINT "triage_erasure_requests_due_after_request_check"
      CHECK ("due_at" > "requested_at"),
    CONSTRAINT "triage_erasure_requests_resolution_check" CHECK (
      (
        "status" IN ('BLOCKED', 'UNDER_REVIEW')
        AND "resolved_at" IS NULL
        AND "resolved_by_user_id" IS NULL
        AND "resolution_code" IS NULL
      ) OR (
        "status" IN ('RESOLVED', 'DENIED')
        AND "resolved_at" IS NOT NULL
        AND "resolved_by_user_id" IS NOT NULL
        AND "resolution_code" IS NOT NULL
      )
    ),
    CONSTRAINT "triage_erasure_requests_triage_assessment_id_fkey"
      FOREIGN KEY ("triage_assessment_id") REFERENCES "triage_assessments"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "triage_erasure_requests_patient_profile_id_fkey"
      FOREIGN KEY ("patient_profile_id") REFERENCES "patient_profiles"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "triage_erasure_requests_resolved_by_user_id_fkey"
      FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "triage_erasure_requests_patient_profile_id_status_requested_at_idx"
    ON "triage_erasure_requests"("patient_profile_id", "status", "requested_at");
CREATE INDEX "triage_erasure_requests_status_due_at_idx"
    ON "triage_erasure_requests"("status", "due_at");

CREATE FUNCTION validate_triage_consent_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM "triage_assessments" assessment
          JOIN "patient_consents" granted
            ON granted."id" = assessment."consent_decision_id"
          JOIN "patient_consents" withdrawn
            ON withdrawn."id" = NEW."withdrawal_decision_id"
         WHERE assessment."id" = NEW."triage_assessment_id"
           AND assessment."patient_profile_id" = NEW."patient_profile_id"
           AND granted."patient_profile_id" = NEW."patient_profile_id"
           AND withdrawn."patient_profile_id" = NEW."patient_profile_id"
           AND granted."consent_document_id" = withdrawn."consent_document_id"
           AND granted."decision" = 'GRANTED'
           AND withdrawn."decision" = 'WITHDRAWN'
           AND withdrawn."care_relationship_id" IS NULL
           AND withdrawn."occurred_at" = NEW."withdrawn_at"
    ) THEN
        RAISE EXCEPTION 'Triage withdrawal must match the patient, assessment and consent version'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "triage_consent_withdrawals_consistent"
AFTER INSERT ON "triage_consent_withdrawals"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_triage_consent_withdrawal();

CREATE FUNCTION validate_triage_erasure_request()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM "triage_assessments"
         WHERE "id" = NEW."triage_assessment_id"
           AND "patient_profile_id" = NEW."patient_profile_id"
    ) THEN
        RAISE EXCEPTION 'Triage erasure request must belong to the assessment patient'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "triage_erasure_requests_consistent"
AFTER INSERT OR UPDATE ON "triage_erasure_requests"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_triage_erasure_request();

CREATE FUNCTION protect_triage_erasure_request()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."triage_assessment_id" IS DISTINCT FROM NEW."triage_assessment_id"
       OR OLD."patient_profile_id" IS DISTINCT FROM NEW."patient_profile_id"
       OR OLD."policy_version" IS DISTINCT FROM NEW."policy_version"
       OR OLD."requested_at" IS DISTINCT FROM NEW."requested_at"
       OR OLD."due_at" IS DISTINCT FROM NEW."due_at" THEN
        RAISE EXCEPTION 'Triage erasure request identity and deadline are immutable'
            USING ERRCODE = '23514';
    END IF;

    IF OLD."status" = 'BLOCKED' AND NEW."status" IN ('UNDER_REVIEW', 'RESOLVED', 'DENIED') THEN
        RETURN NEW;
    END IF;
    IF OLD."status" = 'UNDER_REVIEW' AND NEW."status" IN ('RESOLVED', 'DENIED') THEN
        RETURN NEW;
    END IF;
    IF OLD IS NOT DISTINCT FROM NEW THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Invalid triage erasure request state transition'
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "triage_erasure_requests_state_machine"
BEFORE UPDATE ON "triage_erasure_requests"
FOR EACH ROW EXECUTE FUNCTION protect_triage_erasure_request();
