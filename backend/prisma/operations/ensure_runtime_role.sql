\set ON_ERROR_STOP on

\if :{?application_role}
\else
  \echo 'application_role is required (example: -v application_role=ruta_emocional_runtime)'
  \quit 1
\endif

SELECT format(
  'CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
  :'application_role'
)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_roles WHERE rolname = :'application_role'
) \gexec

SELECT format(
  'ALTER ROLE %I WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
  :'application_role'
) \gexec

\echo 'Runtime group role exists with non-privileged attributes.'
