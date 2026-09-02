import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RuntimeDatabasePrivilegeError,
  RuntimeDatabasePrivilegeRow,
  validateRuntimeDatabasePrivilegeRow,
} from '../../src/shared/infrastructure/database/runtimeDatabasePrivileges';

const validRow: RuntimeDatabasePrivilegeRow = {
  currentUser: 'ruta_emocional_app',
  dedicatedLogin: true,
  safeRoleAttributes: true,
  runtimeMember: true,
  notDatabaseOwner: true,
  cannotCreateObjects: true,
  requiredPrivileges: true,
  forbiddenPrivilegesAbsent: true,
};

test('runtime database privilege evidence accepts a least-privilege login', () => {
  assert.doesNotThrow(() => validateRuntimeDatabasePrivilegeRow(validRow));
});

test('runtime database privilege evidence rejects a login with forbidden grants', () => {
  assert.throws(
    () => validateRuntimeDatabasePrivilegeRow({
      ...validRow,
      forbiddenPrivilegesAbsent: false,
    }),
    RuntimeDatabasePrivilegeError
  );
});
