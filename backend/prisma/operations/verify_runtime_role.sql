\set ON_ERROR_STOP on

\if :{?application_role}
\else
  \echo 'application_role is required (example: -v application_role=ruta_emocional_runtime)'
  \quit 1
\endif

SELECT has_schema_privilege(:'application_role', 'public', 'USAGE') AS check_passed \gset
\if :check_passed
\else
  \echo 'Runtime role must have USAGE on schema public.'
  \quit 1
\endif

SELECT NOT has_schema_privilege(:'application_role', 'public', 'CREATE') AS check_passed \gset
\if :check_passed
\else
  \echo 'Runtime role must not have CREATE on schema public.'
  \quit 1
\endif

SELECT NOT has_database_privilege(:'application_role', current_database(), 'TEMPORARY') AS check_passed \gset
\if :check_passed
\else
  \echo 'Runtime role must not have TEMPORARY on the application database.'
  \quit 1
\endif

SELECT has_table_privilege(:'application_role', 'public.users', 'SELECT')
   AND has_table_privilege(:'application_role', 'public.auth_sessions', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.service_requests', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.specialties', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.care_modalities', 'SELECT')
   AND has_table_privilege(:'application_role', 'public.care_relationship_sources', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.conversations', 'SELECT')
   AND has_table_privilege(:'application_role', 'public.conversation_participants', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.messages', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.outbox_events', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.appointments', 'UPDATE')
   AND has_table_privilege(:'application_role', 'public.clinical_encounters', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.clinical_notes', 'UPDATE')
   AND has_table_privilege(:'application_role', 'public.clinical_note_versions', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.clinical_note_events', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.treatment_plans', 'UPDATE')
   AND has_table_privilege(:'application_role', 'public.triage_needs', 'SELECT')
   AND has_table_privilege(:'application_role', 'public.triage_rules', 'SELECT')
   AND has_table_privilege(:'application_role', 'public.triage_assessments', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.triage_assessment_rule_results', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.request_triage_assessments', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.patient_consents', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.triage_consent_withdrawals', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.triage_erasure_requests', 'INSERT')
   AND has_table_privilege(:'application_role', 'public.menta_conversations', 'UPDATE')
   AND has_table_privilege(:'application_role', 'public.menta_turns', 'UPDATE')
   AND has_table_privilege(:'application_role', 'public.menta_tool_invocations', 'INSERT')
  AS check_passed \gset
\if :check_passed
\else
  \echo 'Runtime role is missing a required application privilege.'
  \quit 1
\endif

SELECT has_column_privilege(:'application_role', 'public.outbox_events', 'published_at', 'UPDATE')
   AND has_column_privilege(:'application_role', 'public.outbox_events', 'claimed_at', 'UPDATE')
   AND has_column_privilege(:'application_role', 'public.outbox_events', 'attempts', 'UPDATE')
  AS check_passed \gset
\if :check_passed
\else
  \echo 'Runtime role is missing the limited outbox worker privileges.'
  \quit 1
\endif

SELECT has_column_privilege(:'application_role', 'public.triage_assessments', 'reviewed_at', 'UPDATE')
   AND has_column_privilege(:'application_role', 'public.triage_assessments', 'reviewed_by_psychologist_id', 'UPDATE')
  AS check_passed \gset
\if :check_passed
\else
  \echo 'Runtime role is missing the limited triage review privileges.'
  \quit 1
\endif

SELECT NOT has_table_privilege(:'application_role', 'public.audit_events', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.audit_events', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.outbox_events', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.messages', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.messages', 'TRUNCATE')
   AND NOT has_table_privilege(:'application_role', 'public.clinical_note_versions', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.clinical_note_versions', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.clinical_note_events', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.care_modalities', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.specialties', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.clinical_records', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.triage_rules', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.triage_assessments', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.triage_assessment_rule_results', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.patient_consents', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.triage_consent_withdrawals', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.triage_erasure_requests', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.triage_erasure_requests', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.menta_conversations', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.menta_turns', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.menta_tool_invocations', 'UPDATE')
   AND NOT has_table_privilege(:'application_role', 'public.menta_tool_invocations', 'DELETE')
   AND NOT has_table_privilege(:'application_role', 'public.users', 'TRIGGER')
  AS check_passed \gset
\if :check_passed
\else
  \echo 'Runtime role has a forbidden destructive privilege.'
  \quit 1
\endif

\echo 'Runtime role privilege checks passed.'
