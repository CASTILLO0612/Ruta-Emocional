\set ON_ERROR_STOP on

\if :{?application_role}
\else
  \echo 'application_role is required (example: -v application_role=ruta_emocional_runtime)'
  \quit 1
\endif

SELECT format(
  'REVOKE CONNECT, TEMPORARY ON DATABASE %I FROM PUBLIC',
  current_database()
) \gexec
SELECT format(
  'GRANT CONNECT ON DATABASE %I TO %I',
  current_database(),
  :'application_role'
) \gexec

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"application_role";

GRANT SELECT, INSERT, UPDATE ON TABLE
  users,
  auth_sessions,
  psychologist_profiles,
  professional_licenses,
  specialties,
  psychologist_modalities,
  service_requests,
  offers,
  appointments,
  clinical_records,
  clinical_encounters,
  clinical_notes,
  treatment_plans,
  treatment_goals
TO :"application_role";

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  psychologist_specialties,
  availability_rules,
  idempotency_records
TO :"application_role";

GRANT SELECT, INSERT ON TABLE
  user_roles,
  patient_profiles,
  professional_verification_submissions,
  availability_exceptions,
  professional_verification_decisions,
  care_relationships,
  care_relationship_sources,
  appointment_events,
  clinical_encounter_appointments,
  clinical_note_versions,
  clinical_note_events,
  conversations,
  conversation_participants,
  messages,
  audit_events,
  outbox_events
TO :"application_role";

GRANT SELECT ON TABLE
  roles,
  care_modalities,
  diagnosis_catalog,
  clinical_diagnoses,
  clinical_diagnosis_sources,
  consent_documents,
  patient_consents,
  reviews
TO :"application_role";

GRANT UPDATE (
  published_at,
  available_at,
  claimed_at,
  claim_token,
  dead_lettered_at,
  attempts,
  last_error
) ON TABLE outbox_events TO :"application_role";

REVOKE CREATE ON SCHEMA public FROM :"application_role";
REVOKE TRUNCATE, TRIGGER ON ALL TABLES IN SCHEMA public FROM :"application_role";

\echo 'Runtime grants applied. Default privileges were intentionally not granted.'
