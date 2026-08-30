-- Phase 8: deterministic, versioned and privacy-minimizing triage.
-- The former MENTA prototype never wrote this table through the supported API.
-- Abort instead of guessing how to reinterpret any unexpected legacy rows.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "triage_assessments") THEN
        RAISE EXCEPTION 'Secure triage migration requires an empty triage_assessments table; reconcile legacy rows offline first';
    END IF;
END;
$$;

CREATE TYPE "triage_provider_outcome" AS ENUM (
    'NOT_USED',
    'SUCCEEDED',
    'UNAVAILABLE',
    'REJECTED_OUTPUT'
);

ALTER TABLE "consent_documents"
    ADD COLUMN "scope" VARCHAR(80),
    ADD COLUMN "content" TEXT,
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "triage_needs" (
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "fallback_summary" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "triage_needs_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "triage_needs_name_key" UNIQUE ("name")
);

CREATE TABLE "triage_need_modalities" (
    "need_code" VARCHAR(50) NOT NULL,
    "modality" "modality" NOT NULL,
    "priority" SMALLINT NOT NULL,
    CONSTRAINT "triage_need_modalities_pkey" PRIMARY KEY ("need_code", "modality"),
    CONSTRAINT "triage_need_modalities_need_code_priority_key" UNIQUE ("need_code", "priority"),
    CONSTRAINT "triage_need_modalities_priority_positive_check" CHECK ("priority" > 0),
    CONSTRAINT "triage_need_modalities_need_code_fkey"
      FOREIGN KEY ("need_code") REFERENCES "triage_needs"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "triage_need_modalities_modality_fkey"
      FOREIGN KEY ("modality") REFERENCES "care_modalities"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "triage_questions" (
    "code" VARCHAR(50) NOT NULL,
    "prompt" VARCHAR(500) NOT NULL,
    "help_text" VARCHAR(500),
    "display_order" SMALLINT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "triage_questions_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "triage_questions_display_order_key" UNIQUE ("display_order"),
    CONSTRAINT "triage_questions_display_order_positive_check" CHECK ("display_order" > 0)
);

CREATE TABLE "triage_answer_options" (
    "code" VARCHAR(80) NOT NULL,
    "question_code" VARCHAR(50) NOT NULL,
    "need_code" VARCHAR(50),
    "modality" "modality",
    "label" VARCHAR(240) NOT NULL,
    "help_text" VARCHAR(500),
    "display_order" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "triage_answer_options_pkey" PRIMARY KEY ("code"),
    CONSTRAINT "triage_answer_options_question_code_display_order_key"
      UNIQUE ("question_code", "display_order"),
    CONSTRAINT "triage_answer_options_display_order_positive_check" CHECK ("display_order" > 0),
    CONSTRAINT "triage_answer_options_single_projection_check"
      CHECK (num_nonnulls("need_code", "modality") <= 1),
    CONSTRAINT "triage_answer_options_question_code_fkey"
      FOREIGN KEY ("question_code") REFERENCES "triage_questions"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "triage_answer_options_need_code_fkey"
      FOREIGN KEY ("need_code") REFERENCES "triage_needs"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "triage_answer_options_modality_fkey"
      FOREIGN KEY ("modality") REFERENCES "care_modalities"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "triage_answer_options_question_code_is_active_idx"
    ON "triage_answer_options"("question_code", "is_active");

CREATE TABLE "triage_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(80) NOT NULL,
    "version" VARCHAR(30) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "trigger_option_code" VARCHAR(80) NOT NULL,
    "risk_level" "triage_risk_level" NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "valid_until" TIMESTAMPTZ(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "triage_rules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "triage_rules_code_version_key" UNIQUE ("code", "version"),
    CONSTRAINT "triage_rules_time_range_check"
      CHECK ("valid_until" IS NULL OR "valid_from" < "valid_until"),
    CONSTRAINT "triage_rules_trigger_option_code_fkey"
      FOREIGN KEY ("trigger_option_code") REFERENCES "triage_answer_options"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "triage_rules_is_active_valid_from_valid_until_idx"
    ON "triage_rules"("is_active", "valid_from", "valid_until");

INSERT INTO "triage_needs" (
    "code", "name", "description", "fallback_summary"
) VALUES
    ('ANXIETY_STRESS', 'Ansiedad o estrés', 'Preocupación, tensión o sobrecarga emocional.', 'Tus respuestas indican que buscas apoyo para manejar ansiedad o estrés. Un profesional puede ayudarte a explorar estrategias adecuadas para tu situación.'),
    ('MOOD', 'Estado de ánimo', 'Tristeza, desánimo o cambios persistentes de ánimo.', 'Tus respuestas indican que buscas apoyo relacionado con tu estado de ánimo. Esta orientación no es un diagnóstico; conversar con un profesional puede ayudarte a comprender lo que estás viviendo.'),
    ('GRIEF_LOSS', 'Duelo o pérdida', 'Acompañamiento ante una pérdida o cambio importante.', 'Tus respuestas indican que buscas acompañamiento ante una pérdida o cambio importante. Un profesional puede ofrecerte un espacio seguro para procesar esta experiencia.'),
    ('RELATIONSHIPS', 'Relaciones', 'Dificultades de pareja, familia o vínculos personales.', 'Tus respuestas indican que buscas apoyo para una dificultad relacional. Un profesional puede ayudarte a revisar el contexto y tus opciones sin juzgarte.'),
    ('LIFE_CHANGES', 'Cambios de vida', 'Adaptación a estudios, trabajo, salud u otras transiciones.', 'Tus respuestas indican que buscas apoyo durante una transición importante. Un profesional puede ayudarte a organizar necesidades y recursos de afrontamiento.'),
    ('OTHER', 'Otro motivo', 'Una necesidad de apoyo emocional no incluida en las categorías anteriores.', 'Tus respuestas indican que deseas orientación emocional. Un profesional puede ayudarte a definir con más claridad el tipo de apoyo que necesitas.');

INSERT INTO "triage_need_modalities" ("need_code", "modality", "priority") VALUES
    ('ANXIETY_STRESS', 'CALL', 1), ('ANXIETY_STRESS', 'CHAT', 2), ('ANXIETY_STRESS', 'IN_PERSON', 3),
    ('MOOD', 'CALL', 1), ('MOOD', 'IN_PERSON', 2), ('MOOD', 'CHAT', 3),
    ('GRIEF_LOSS', 'CALL', 1), ('GRIEF_LOSS', 'IN_PERSON', 2), ('GRIEF_LOSS', 'CHAT', 3),
    ('RELATIONSHIPS', 'CALL', 1), ('RELATIONSHIPS', 'IN_PERSON', 2), ('RELATIONSHIPS', 'CHAT', 3),
    ('LIFE_CHANGES', 'CHAT', 1), ('LIFE_CHANGES', 'CALL', 2), ('LIFE_CHANGES', 'IN_PERSON', 3),
    ('OTHER', 'CALL', 1), ('OTHER', 'CHAT', 2), ('OTHER', 'IN_PERSON', 3);

INSERT INTO "triage_questions" (
    "code", "prompt", "help_text", "display_order"
) VALUES
    ('PRIMARY_NEED', '¿Qué describe mejor el apoyo que buscas?', 'Selecciona la opción más cercana. No necesitas escribir información personal.', 1),
    ('SUPPORT_PREFERENCE', '¿Cómo te resultaría más cómodo recibir apoyo?', 'Esta preferencia ayuda a ordenar las opciones; no sustituye una recomendación profesional.', 2),
    ('CURRENT_SAFETY', '¿Te encuentras en peligro inmediato en este momento?', 'Considera cualquier riesgo urgente para tu seguridad o la de otra persona.', 3),
    ('SELF_HARM', '¿Has tenido pensamientos de hacerte daño?', 'Elige la opción que describa mejor este momento.', 4),
    ('HARM_OTHERS', '¿Has tenido pensamientos de hacer daño a otra persona?', 'Elige la opción que describa mejor este momento.', 5),
    ('VIOLENCE_ABUSE', '¿Estás viviendo violencia, abuso o amenazas actualmente?', 'Si existe peligro inmediato, selecciona la opción correspondiente en la pregunta de seguridad.', 6);

INSERT INTO "triage_answer_options" (
    "code", "question_code", "need_code", "modality", "label", "display_order"
) VALUES
    ('NEED_ANXIETY_STRESS', 'PRIMARY_NEED', 'ANXIETY_STRESS', NULL, 'Ansiedad o estrés', 1),
    ('NEED_MOOD', 'PRIMARY_NEED', 'MOOD', NULL, 'Estado de ánimo', 2),
    ('NEED_GRIEF_LOSS', 'PRIMARY_NEED', 'GRIEF_LOSS', NULL, 'Duelo o pérdida', 3),
    ('NEED_RELATIONSHIPS', 'PRIMARY_NEED', 'RELATIONSHIPS', NULL, 'Relaciones', 4),
    ('NEED_LIFE_CHANGES', 'PRIMARY_NEED', 'LIFE_CHANGES', NULL, 'Cambios de vida', 5),
    ('NEED_OTHER', 'PRIMARY_NEED', 'OTHER', NULL, 'Otro motivo', 6),
    ('PREFERENCE_CHAT', 'SUPPORT_PREFERENCE', NULL, 'CHAT', 'Chat seguro', 1),
    ('PREFERENCE_CALL', 'SUPPORT_PREFERENCE', NULL, 'CALL', 'Atención remota', 2),
    ('PREFERENCE_IN_PERSON', 'SUPPORT_PREFERENCE', NULL, 'IN_PERSON', 'Atención presencial', 3),
    ('SAFETY_SAFE_NOW', 'CURRENT_SAFETY', NULL, NULL, 'No, estoy a salvo en este momento', 1),
    ('SAFETY_UNSAFE_NOW', 'CURRENT_SAFETY', NULL, NULL, 'Sí, existe peligro inmediato', 2),
    ('SELF_HARM_NONE', 'SELF_HARM', NULL, NULL, 'No', 1),
    ('SELF_HARM_THOUGHTS', 'SELF_HARM', NULL, NULL, 'Sí, pero sin un plan o intención inmediata', 2),
    ('SELF_HARM_PLAN_OR_INTENT', 'SELF_HARM', NULL, NULL, 'Sí, con un plan o intención de actuar', 3),
    ('HARM_OTHERS_NONE', 'HARM_OTHERS', NULL, NULL, 'No', 1),
    ('HARM_OTHERS_THOUGHTS', 'HARM_OTHERS', NULL, NULL, 'Sí, pero sin un plan o intención inmediata', 2),
    ('HARM_OTHERS_PLAN_OR_INTENT', 'HARM_OTHERS', NULL, NULL, 'Sí, con un plan o intención de actuar', 3),
    ('VIOLENCE_ABUSE_NO', 'VIOLENCE_ABUSE', NULL, NULL, 'No', 1),
    ('VIOLENCE_ABUSE_CURRENT', 'VIOLENCE_ABUSE', NULL, NULL, 'Sí', 2);

INSERT INTO "triage_rules" (
    "code", "version", "name", "description", "trigger_option_code", "risk_level", "valid_from"
) VALUES
    ('IMMEDIATE_DANGER', '1.0.0', 'Peligro inmediato', 'Interrumpe toda orientación comercial cuando la persona declara peligro inmediato.', 'SAFETY_UNSAFE_NOW', 'CRITICAL', '2026-08-30T00:00:00Z'),
    ('SELF_HARM_PLAN', '1.0.0', 'Plan o intención de autolesión', 'Prioriza recursos inmediatos ante plan o intención declarada.', 'SELF_HARM_PLAN_OR_INTENT', 'CRITICAL', '2026-08-30T00:00:00Z'),
    ('HARM_OTHERS_PLAN', '1.0.0', 'Plan o intención de dañar a otra persona', 'Prioriza recursos inmediatos ante plan o intención declarada.', 'HARM_OTHERS_PLAN_OR_INTENT', 'CRITICAL', '2026-08-30T00:00:00Z'),
    ('SELF_HARM_THOUGHTS', '1.0.0', 'Pensamientos de autolesión', 'Eleva la orientación a prioridad alta aunque no se declare plan inmediato.', 'SELF_HARM_THOUGHTS', 'HIGH', '2026-08-30T00:00:00Z'),
    ('HARM_OTHERS_THOUGHTS', '1.0.0', 'Pensamientos de dañar a otra persona', 'Eleva la orientación a prioridad alta aunque no se declare plan inmediato.', 'HARM_OTHERS_THOUGHTS', 'HIGH', '2026-08-30T00:00:00Z'),
    ('CURRENT_VIOLENCE_OR_ABUSE', '1.0.0', 'Violencia o abuso actual', 'Prioriza ayuda oportuna cuando se declara violencia, abuso o amenazas.', 'VIOLENCE_ABUSE_CURRENT', 'HIGH', '2026-08-30T00:00:00Z');

WITH document_content AS (
    SELECT 'MENTA es un sistema automatizado de orientación, no un servicio de emergencia ni un reemplazo de atención profesional. No realiza diagnósticos ni prescribe tratamientos. Tus respuestas estructuradas se utilizarán para estimar un nivel de urgencia, mostrar recursos de seguridad y, si vinculas la evaluación a una solicitud, compartir el resultado estructurado con el profesional que elijas. Ruta Emocional no contactará servicios de emergencia por ti.'::TEXT AS value
)
INSERT INTO "consent_documents" (
    "code", "version", "title", "scope", "content", "content_hash", "published_at", "is_active"
)
SELECT
    'MENTA_ORIENTATION',
    '1.0.0',
    'Consentimiento para orientación automatizada MENTA',
    'TRIAGE_ORIENTATION',
    value,
    encode(digest(value, 'sha256'), 'hex'),
    '2026-08-30T00:00:00Z',
    true
FROM document_content
ON CONFLICT ("code", "version") DO NOTHING;

ALTER TABLE "triage_assessments"
    DROP CONSTRAINT "triage_assessments_recommended_modality_fkey",
    DROP CONSTRAINT "triage_assessments_budget_check";

ALTER TABLE "triage_assessments"
    RENAME COLUMN "prompt_version" TO "evaluator_version";
ALTER TABLE "triage_assessments"
    RENAME COLUMN "primary_need" TO "primary_need_code";
ALTER TABLE "triage_assessments"
    RENAME COLUMN "summary" TO "orientation_summary";

ALTER TABLE "triage_assessments"
    ALTER COLUMN "primary_need_code" TYPE VARCHAR(50),
    ADD COLUMN "consent_decision_id" UUID NOT NULL,
    ADD COLUMN "provider_outcome" "triage_provider_outcome" NOT NULL DEFAULT 'NOT_USED',
    ADD COLUMN "country_code" CHAR(2) NOT NULL,
    DROP COLUMN "recommended_modality",
    DROP COLUMN "suggested_budget_min",
    DROP COLUMN "suggested_budget_max";

ALTER TABLE "triage_assessments"
    ADD CONSTRAINT "triage_assessments_consent_decision_id_fkey"
      FOREIGN KEY ("consent_decision_id") REFERENCES "patient_consents"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "triage_assessments_primary_need_code_fkey"
      FOREIGN KEY ("primary_need_code") REFERENCES "triage_needs"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "triage_assessments_country_code_check"
      CHECK ("country_code" = upper("country_code") AND "country_code" ~ '^[A-Z]{2}$');

CREATE INDEX "triage_assessments_consent_decision_id_idx"
    ON "triage_assessments"("consent_decision_id");

CREATE TABLE "triage_assessment_modalities" (
    "triage_assessment_id" UUID NOT NULL,
    "modality" "modality" NOT NULL,
    "priority" SMALLINT NOT NULL,
    CONSTRAINT "triage_assessment_modalities_pkey"
      PRIMARY KEY ("triage_assessment_id", "modality"),
    CONSTRAINT "triage_assessment_modalities_triage_assessment_id_priority_key"
      UNIQUE ("triage_assessment_id", "priority"),
    CONSTRAINT "triage_assessment_modalities_priority_positive_check" CHECK ("priority" > 0),
    CONSTRAINT "triage_assessment_modalities_triage_assessment_id_fkey"
      FOREIGN KEY ("triage_assessment_id") REFERENCES "triage_assessments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "triage_assessment_modalities_modality_fkey"
      FOREIGN KEY ("modality") REFERENCES "care_modalities"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "triage_assessment_rule_results" (
    "triage_assessment_id" UUID NOT NULL,
    "triage_rule_id" UUID NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "evidence_option_code" VARCHAR(80),
    CONSTRAINT "triage_assessment_rule_results_pkey"
      PRIMARY KEY ("triage_assessment_id", "triage_rule_id"),
    CONSTRAINT "triage_assessment_rule_results_evidence_check"
      CHECK (("matched" AND "evidence_option_code" IS NOT NULL) OR (NOT "matched" AND "evidence_option_code" IS NULL)),
    CONSTRAINT "triage_assessment_rule_results_triage_assessment_id_fkey"
      FOREIGN KEY ("triage_assessment_id") REFERENCES "triage_assessments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "triage_assessment_rule_results_triage_rule_id_fkey"
      FOREIGN KEY ("triage_rule_id") REFERENCES "triage_rules"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "triage_assessment_rule_results_evidence_option_code_fkey"
      FOREIGN KEY ("evidence_option_code") REFERENCES "triage_answer_options"("code")
      ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "triage_assessment_rule_results_triage_rule_id_matched_idx"
    ON "triage_assessment_rule_results"("triage_rule_id", "matched");

ALTER TABLE "care_relationship_sources"
    ADD COLUMN "triage_assessment_id" UUID,
    ADD CONSTRAINT "care_relationship_sources_triage_assessment_id_key" UNIQUE ("triage_assessment_id"),
    ADD CONSTRAINT "care_relationship_sources_triage_assessment_id_fkey"
      FOREIGN KEY ("triage_assessment_id") REFERENCES "triage_assessments"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION validate_triage_rule_result()
RETURNS TRIGGER AS $$
DECLARE
    expected_option VARCHAR(80);
BEGIN
    SELECT "trigger_option_code" INTO expected_option
      FROM "triage_rules"
     WHERE "id" = NEW."triage_rule_id";

    IF NEW."matched" AND NEW."evidence_option_code" IS DISTINCT FROM expected_option THEN
        RAISE EXCEPTION 'Matched triage rule evidence must equal its versioned trigger option'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "triage_rule_results_match_trigger"
AFTER INSERT OR UPDATE ON "triage_assessment_rule_results"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_triage_rule_result();

CREATE FUNCTION validate_triage_assessment_consistency_for(assessment_id UUID)
RETURNS VOID AS $$
DECLARE
    assessment_risk "triage_risk_level";
    expected_risk "triage_risk_level";
    modality_count INTEGER;
    result_count INTEGER;
BEGIN
    SELECT "risk_level" INTO assessment_risk
      FROM "triage_assessments"
     WHERE "id" = assessment_id;
    IF assessment_risk IS NULL THEN
        RETURN;
    END IF;

    SELECT count(*) INTO modality_count
      FROM "triage_assessment_modalities"
     WHERE "triage_assessment_id" = assessment_id;
    SELECT count(*) INTO result_count
      FROM "triage_assessment_rule_results"
     WHERE "triage_assessment_id" = assessment_id;

    IF result_count = 0 THEN
        RAISE EXCEPTION 'A triage assessment must record every applied rule result'
            USING ERRCODE = '23514';
    END IF;
    IF assessment_risk IN ('HIGH', 'CRITICAL') AND modality_count <> 0 THEN
        RAISE EXCEPTION 'High or critical triage cannot contain commercial modality recommendations'
            USING ERRCODE = '23514';
    END IF;
    IF assessment_risk IN ('LOW', 'MODERATE') AND modality_count = 0 THEN
        RAISE EXCEPTION 'Low or moderate triage requires at least one orientation modality'
            USING ERRCODE = '23514';
    END IF;

    SELECT CASE
             WHEN bool_or(result."matched" AND rule."risk_level" = 'CRITICAL') THEN 'CRITICAL'::"triage_risk_level"
             WHEN bool_or(result."matched" AND rule."risk_level" = 'HIGH') THEN 'HIGH'::"triage_risk_level"
             WHEN bool_or(result."matched" AND rule."risk_level" = 'MODERATE') THEN 'MODERATE'::"triage_risk_level"
             ELSE 'LOW'::"triage_risk_level"
           END
      INTO expected_risk
      FROM "triage_assessment_rule_results" result
      JOIN "triage_rules" rule ON rule."id" = result."triage_rule_id"
     WHERE result."triage_assessment_id" = assessment_id;

    IF assessment_risk IS DISTINCT FROM expected_risk THEN
        RAISE EXCEPTION 'Triage risk does not match the maximum deterministic rule result'
            USING ERRCODE = '23514';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION validate_triage_assessment_consistency()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM validate_triage_assessment_consistency_for(
        CASE WHEN TG_OP = 'DELETE' THEN OLD."triage_assessment_id" ELSE NEW."triage_assessment_id" END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION validate_triage_assessment_row_consistency()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM validate_triage_assessment_consistency_for(NEW."id");
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "triage_assessments_consistent"
AFTER INSERT OR UPDATE ON "triage_assessments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_triage_assessment_row_consistency();

CREATE CONSTRAINT TRIGGER "triage_assessment_modalities_consistent"
AFTER INSERT OR UPDATE OR DELETE ON "triage_assessment_modalities"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_triage_assessment_consistency();

CREATE CONSTRAINT TRIGGER "triage_assessment_rule_results_consistent"
AFTER INSERT OR UPDATE OR DELETE ON "triage_assessment_rule_results"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_triage_assessment_consistency();

CREATE FUNCTION protect_triage_assessment()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD."patient_profile_id" IS DISTINCT FROM NEW."patient_profile_id"
       OR OLD."consent_decision_id" IS DISTINCT FROM NEW."consent_decision_id"
       OR OLD."primary_need_code" IS DISTINCT FROM NEW."primary_need_code"
       OR OLD."provider" IS DISTINCT FROM NEW."provider"
       OR OLD."model" IS DISTINCT FROM NEW."model"
       OR OLD."evaluator_version" IS DISTINCT FROM NEW."evaluator_version"
       OR OLD."provider_outcome" IS DISTINCT FROM NEW."provider_outcome"
       OR OLD."country_code" IS DISTINCT FROM NEW."country_code"
       OR OLD."orientation_summary" IS DISTINCT FROM NEW."orientation_summary"
       OR OLD."risk_level" IS DISTINCT FROM NEW."risk_level"
       OR OLD."created_at" IS DISTINCT FROM NEW."created_at" THEN
        RAISE EXCEPTION 'Triage assessment output is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF OLD."reviewed_by_psychologist_id" IS NULL
       AND OLD."reviewed_at" IS NULL
       AND NEW."reviewed_by_psychologist_id" IS NOT NULL
       AND NEW."reviewed_at" IS NOT NULL THEN
        RETURN NEW;
    END IF;
    IF OLD."reviewed_by_psychologist_id" IS NOT DISTINCT FROM NEW."reviewed_by_psychologist_id"
       AND OLD."reviewed_at" IS NOT DISTINCT FROM NEW."reviewed_at" THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Triage review metadata is append-only'
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "triage_assessments_patient_immutable" ON "triage_assessments";
CREATE TRIGGER "triage_assessments_immutable"
BEFORE UPDATE ON "triage_assessments"
FOR EACH ROW EXECUTE FUNCTION protect_triage_assessment();

CREATE FUNCTION validate_triage_consent_patient()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM "patient_consents" consent
          JOIN "consent_documents" document ON document."id" = consent."consent_document_id"
         WHERE consent."id" = NEW."consent_decision_id"
           AND consent."patient_profile_id" = NEW."patient_profile_id"
           AND consent."decision" = 'GRANTED'
           AND consent."care_relationship_id" IS NULL
           AND document."scope" = 'TRIAGE_ORIENTATION'
           AND document."is_active" = true
    ) THEN
        RAISE EXCEPTION 'Triage assessment requires a matching granted consent decision'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "triage_assessments_match_consent"
AFTER INSERT ON "triage_assessments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_triage_consent_patient();

CREATE FUNCTION validate_request_open_for_triage_link()
RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM "service_requests"
         WHERE "id" = NEW."service_request_id"
           AND "status" IN ('PENDING', 'BIDDING')
    ) THEN
        RAISE EXCEPTION 'Only an open service request can receive a new triage assessment'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "request_triage_assessments_require_open_request"
BEFORE INSERT ON "request_triage_assessments"
FOR EACH ROW EXECUTE FUNCTION validate_request_open_for_triage_link();

CREATE FUNCTION validate_care_relationship_triage_source()
RETURNS TRIGGER AS $$
DECLARE
    source_request_id UUID;
    latest_assessment_id UUID;
BEGIN
    IF NEW."triage_assessment_id" IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT "request_id" INTO source_request_id
      FROM "offers"
     WHERE "id" = NEW."accepted_offer_id";

    SELECT link."triage_assessment_id" INTO latest_assessment_id
      FROM "request_triage_assessments" link
      JOIN "triage_assessments" assessment ON assessment."id" = link."triage_assessment_id"
     WHERE link."service_request_id" = source_request_id
     ORDER BY assessment."created_at" DESC, assessment."id" DESC
     LIMIT 1;

    IF latest_assessment_id IS DISTINCT FROM NEW."triage_assessment_id" THEN
        RAISE EXCEPTION 'Care relationship must freeze the latest triage linked before acceptance'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "care_relationship_sources_match_triage"
AFTER INSERT OR UPDATE OF "triage_assessment_id", "accepted_offer_id"
ON "care_relationship_sources"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_care_relationship_triage_source();
