\set ON_ERROR_STOP on

\if :{?application_role}
\else
  \echo 'application_role is required (example: -v application_role=ruta_emocional_runtime)'
  \quit 1
\endif

SELECT current_user <> :'application_role' AS check_passed \gset
\if :check_passed
\else
  \echo 'The application must connect with a LOGIN member, not the NOLOGIN group role.'
  \quit 1
\endif

SELECT role.rolcanlogin
   AND NOT role.rolsuper
   AND NOT role.rolcreatedb
   AND NOT role.rolcreaterole
   AND NOT role.rolreplication
   AND NOT role.rolbypassrls
  AS check_passed
  FROM pg_roles role
 WHERE role.rolname = current_user
\gset
\if :check_passed
\else
  \echo 'The connected application identity has forbidden PostgreSQL attributes.'
  \quit 1
\endif

SELECT pg_has_role(current_user, :'application_role', 'MEMBER') AS check_passed \gset
\if :check_passed
\else
  \echo 'The application login is not a member of the expected runtime role.'
  \quit 1
\endif

SELECT NOT EXISTS (
         SELECT 1
           FROM pg_database database
          WHERE database.datname = current_database()
            AND pg_get_userbyid(database.datdba) = current_user
       )
   AND NOT has_schema_privilege(current_user, 'public', 'CREATE')
   AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
   AND NOT has_database_privilege(current_user, current_database(), 'TEMPORARY')
  AS check_passed
\gset
\if :check_passed
\else
  \echo 'The application login owns or can create database objects.'
  \quit 1
\endif

SELECT has_table_privilege(current_user, 'public.users', 'SELECT')
   AND has_table_privilege(current_user, 'public.triage_assessments', 'INSERT')
   AND has_table_privilege(current_user, 'public.triage_consent_withdrawals', 'INSERT')
   AND has_table_privilege(current_user, 'public.triage_erasure_requests', 'INSERT')
   AND NOT has_table_privilege(current_user, 'public.audit_events', 'DELETE')
   AND NOT has_table_privilege(current_user, 'public.audit_events', 'TRUNCATE')
   AND NOT has_table_privilege(current_user, 'public.triage_assessments', 'DELETE')
   AND NOT has_table_privilege(current_user, 'public.triage_consent_withdrawals', 'UPDATE')
   AND NOT has_table_privilege(current_user, 'public.triage_erasure_requests', 'UPDATE')
   AND NOT has_table_privilege(current_user, 'public.triage_erasure_requests', 'DELETE')
   AND NOT has_table_privilege(current_user, 'public.triage_rules', 'UPDATE')
  AS check_passed
\gset
\if :check_passed
\else
  \echo 'The effective application privileges do not match the runtime contract.'
  \quit 1
\endif

\echo 'Application login identity and effective privilege checks passed.'
