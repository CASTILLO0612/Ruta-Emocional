-- Cross-table invariants preserve consistency without denormalizing patient,
-- psychologist or clinical-record identifiers into association tables. They are
-- deferred so a complete aggregate can be created atomically in any safe order.

CREATE FUNCTION validate_care_relationship_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM care_relationships AS relationship
        JOIN service_requests AS request
          ON request.id = NEW.service_request_id
        JOIN offers AS accepted_offer
          ON accepted_offer.request_id = request.id
         AND accepted_offer.status = 'ACCEPTED'
        WHERE relationship.id = NEW.care_relationship_id
          AND relationship.patient_profile_id = request.patient_profile_id
          AND relationship.psychologist_profile_id = accepted_offer.psychologist_profile_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Care relationship does not match the accepted service request';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER care_relationship_sources_match_request
AFTER INSERT OR UPDATE ON care_relationship_sources
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_care_relationship_source();

CREATE FUNCTION validate_appointment_request()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM appointments AS appointment
        JOIN service_requests AS request
          ON request.id = NEW.service_request_id
        JOIN offers AS accepted_offer
          ON accepted_offer.request_id = request.id
         AND accepted_offer.status = 'ACCEPTED'
        WHERE appointment.id = NEW.appointment_id
          AND appointment.patient_profile_id = request.patient_profile_id
          AND appointment.psychologist_profile_id = accepted_offer.psychologist_profile_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Appointment participants do not match the accepted service request';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER appointment_requests_match_participants
AFTER INSERT OR UPDATE ON appointment_requests
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_appointment_request();

CREATE FUNCTION validate_appointment_care_relationship()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM appointments AS appointment
        JOIN care_relationships AS relationship
          ON relationship.id = NEW.care_relationship_id
        WHERE appointment.id = NEW.appointment_id
          AND appointment.patient_profile_id = relationship.patient_profile_id
          AND appointment.psychologist_profile_id = relationship.psychologist_profile_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Appointment participants do not match the care relationship';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER appointment_care_relationships_match_participants
AFTER INSERT OR UPDATE ON appointment_care_relationships
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_appointment_care_relationship();

CREATE FUNCTION validate_clinical_encounter_appointment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM clinical_encounters AS encounter
        JOIN clinical_records AS record
          ON record.id = encounter.clinical_record_id
        JOIN appointments AS appointment
          ON appointment.id = NEW.appointment_id
        WHERE encounter.id = NEW.clinical_encounter_id
          AND record.patient_profile_id = appointment.patient_profile_id
          AND encounter.psychologist_profile_id = appointment.psychologist_profile_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Clinical encounter does not match the appointment participants';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER clinical_encounter_appointments_match_participants
AFTER INSERT OR UPDATE ON clinical_encounter_appointments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_clinical_encounter_appointment();

CREATE FUNCTION validate_clinical_diagnosis_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM clinical_diagnoses AS diagnosis
        JOIN clinical_encounters AS encounter
          ON encounter.id = NEW.clinical_encounter_id
        WHERE diagnosis.id = NEW.clinical_diagnosis_id
          AND diagnosis.clinical_record_id = encounter.clinical_record_id
          AND diagnosis.psychologist_profile_id = encounter.psychologist_profile_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Clinical diagnosis does not match its source encounter';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER clinical_diagnosis_sources_match_encounter
AFTER INSERT OR UPDATE ON clinical_diagnosis_sources
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_clinical_diagnosis_source();

CREATE FUNCTION validate_request_triage_patient()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM triage_assessments AS assessment
        JOIN service_requests AS request
          ON request.id = NEW.service_request_id
        WHERE assessment.id = NEW.triage_assessment_id
          AND assessment.patient_profile_id = request.patient_profile_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'Triage assessment and service request belong to different patients';
    END IF;

    RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER request_triage_assessments_match_patient
AFTER INSERT OR UPDATE ON request_triage_assessments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION validate_request_triage_patient();

-- Once relational identities participate in history or association tables they
-- are immutable. Corrections must create an explicit replacement/correction
-- event rather than silently rewriting clinical or financial history.
CREATE FUNCTION reject_immutable_relationship_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = format('Immutable relationship identity cannot be changed on %I', TG_TABLE_NAME);
END;
$$;

CREATE TRIGGER service_requests_patient_immutable
BEFORE UPDATE OF patient_profile_id ON service_requests
FOR EACH ROW
WHEN (OLD.patient_profile_id IS DISTINCT FROM NEW.patient_profile_id)
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE TRIGGER offers_identity_immutable
BEFORE UPDATE OF request_id, psychologist_profile_id ON offers
FOR EACH ROW
WHEN (
    OLD.request_id IS DISTINCT FROM NEW.request_id
    OR OLD.psychologist_profile_id IS DISTINCT FROM NEW.psychologist_profile_id
)
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE TRIGGER care_relationships_participants_immutable
BEFORE UPDATE OF patient_profile_id, psychologist_profile_id ON care_relationships
FOR EACH ROW
WHEN (
    OLD.patient_profile_id IS DISTINCT FROM NEW.patient_profile_id
    OR OLD.psychologist_profile_id IS DISTINCT FROM NEW.psychologist_profile_id
)
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE TRIGGER appointments_participants_immutable
BEFORE UPDATE OF patient_profile_id, psychologist_profile_id ON appointments
FOR EACH ROW
WHEN (
    OLD.patient_profile_id IS DISTINCT FROM NEW.patient_profile_id
    OR OLD.psychologist_profile_id IS DISTINCT FROM NEW.psychologist_profile_id
)
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE TRIGGER clinical_encounters_identity_immutable
BEFORE UPDATE OF clinical_record_id, psychologist_profile_id ON clinical_encounters
FOR EACH ROW
WHEN (
    OLD.clinical_record_id IS DISTINCT FROM NEW.clinical_record_id
    OR OLD.psychologist_profile_id IS DISTINCT FROM NEW.psychologist_profile_id
)
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE TRIGGER clinical_diagnoses_identity_immutable
BEFORE UPDATE OF clinical_record_id, psychologist_profile_id ON clinical_diagnoses
FOR EACH ROW
WHEN (
    OLD.clinical_record_id IS DISTINCT FROM NEW.clinical_record_id
    OR OLD.psychologist_profile_id IS DISTINCT FROM NEW.psychologist_profile_id
)
EXECUTE FUNCTION reject_immutable_relationship_change();

CREATE TRIGGER triage_assessments_patient_immutable
BEFORE UPDATE OF patient_profile_id ON triage_assessments
FOR EACH ROW
WHEN (OLD.patient_profile_id IS DISTINCT FROM NEW.patient_profile_id)
EXECUTE FUNCTION reject_immutable_relationship_change();
