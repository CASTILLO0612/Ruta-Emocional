import { Prisma, PrismaClient } from '../../../generated/prisma/client';

export class RuntimeDatabasePrivilegeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeDatabasePrivilegeError';
  }
}

export interface RuntimeDatabasePrivilegeRow {
  readonly currentUser: string;
  readonly dedicatedLogin: boolean;
  readonly safeRoleAttributes: boolean;
  readonly runtimeMember: boolean;
  readonly notDatabaseOwner: boolean;
  readonly cannotCreateObjects: boolean;
  readonly requiredPrivileges: boolean;
  readonly forbiddenPrivilegesAbsent: boolean;
}

export function validateRuntimeDatabasePrivilegeRow(row: RuntimeDatabasePrivilegeRow): void {
  const failedChecks = Object.entries(row)
    .filter(([key, value]) => key !== 'currentUser' && value !== true)
    .map(([key]) => key);
  if (failedChecks.length) {
    throw new RuntimeDatabasePrivilegeError(
      `PostgreSQL runtime identity failed checks: ${failedChecks.join(', ')}`
    );
  }
}

export async function assertRuntimeDatabasePrivileges(
  prisma: PrismaClient,
  runtimeRole: string
): Promise<void> {
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(runtimeRole)) {
    throw new RuntimeDatabasePrivilegeError('POSTGRES_RUNTIME_ROLE is not a valid role name');
  }
  const [row] = await prisma.$queryRaw<RuntimeDatabasePrivilegeRow[]>(Prisma.sql`
    SELECT
      current_user AS "currentUser",
      current_user <> ${runtimeRole} AS "dedicatedLogin",
      role.rolcanlogin
        AND NOT role.rolsuper
        AND NOT role.rolcreatedb
        AND NOT role.rolcreaterole
        AND NOT role.rolreplication
        AND NOT role.rolbypassrls AS "safeRoleAttributes",
      pg_has_role(current_user, ${runtimeRole}, 'MEMBER') AS "runtimeMember",
      NOT EXISTS (
        SELECT 1
          FROM pg_database database
         WHERE database.datname = current_database()
           AND pg_get_userbyid(database.datdba) = current_user
      ) AS "notDatabaseOwner",
      NOT has_schema_privilege(current_user, 'public', 'CREATE')
        AND NOT has_database_privilege(current_user, current_database(), 'CREATE')
        AND NOT has_database_privilege(current_user, current_database(), 'TEMPORARY')
        AS "cannotCreateObjects",
      has_table_privilege(current_user, 'public.users', 'SELECT')
        AND has_table_privilege(current_user, 'public.triage_assessments', 'INSERT')
        AND has_table_privilege(current_user, 'public.triage_consent_withdrawals', 'INSERT')
        AND has_table_privilege(current_user, 'public.triage_erasure_requests', 'INSERT')
        AS "requiredPrivileges",
      NOT has_table_privilege(current_user, 'public.audit_events', 'DELETE')
        AND NOT has_table_privilege(current_user, 'public.audit_events', 'TRUNCATE')
        AND NOT has_table_privilege(current_user, 'public.triage_assessments', 'DELETE')
        AND NOT has_table_privilege(current_user, 'public.triage_rules', 'UPDATE')
        AND NOT has_table_privilege(current_user, 'public.triage_erasure_requests', 'UPDATE')
        AND NOT has_table_privilege(current_user, 'public.triage_erasure_requests', 'DELETE')
        AS "forbiddenPrivilegesAbsent"
      FROM pg_roles role
     WHERE role.rolname = current_user
  `);
  if (!row) {
    throw new RuntimeDatabasePrivilegeError('PostgreSQL runtime identity was not found');
  }
  validateRuntimeDatabasePrivilegeRow(row);
}
