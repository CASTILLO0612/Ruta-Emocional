import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { ClinicalRecordService } from '../../src/modules/clinical-record/application/clinicalRecordService';
import { ClinicalRecordRepository } from '../../src/modules/clinical-record/application/ports';
import { AesGcmClinicalContentCipher } from '../../src/modules/clinical-record/infrastructure/security/aesGcmClinicalContentCipher';
import { AppError } from '../../src/shared/domain/appError';
import { createTestConfig } from '../support/testConfig';

const key = createHash('sha256').update('clinical-unit-key').digest('base64');

test('clinical cipher authenticates content and binds it to the note version', () => {
  const cipher = new AesGcmClinicalContentCipher({ 1: key }, 1);
  const plaintext = 'Contenido clínico sensible de prueba';
  const context = 'clinical-note:00000000-0000-4000-8000-000000000001:version:1';
  const encrypted = cipher.encrypt(plaintext, context);

  assert.notEqual(encrypted, plaintext);
  assert.match(encrypted, /^v1\./);
  assert.equal(cipher.decrypt(encrypted, context), plaintext);
  assert.throws(() => cipher.decrypt(encrypted, `${context}:altered`));
});

test('clinical cipher can decrypt a previous key version after rotation', () => {
  const rotatedKey = createHash('sha256').update('clinical-unit-key-rotated').digest('base64');
  const previous = new AesGcmClinicalContentCipher({ 1: key }, 1);
  const envelope = previous.encrypt('Versión anterior', 'rotation-context');
  const current = new AesGcmClinicalContentCipher({ 1: key, 2: rotatedKey }, 2);

  assert.equal(current.decrypt(envelope, 'rotation-context'), 'Versión anterior');
  assert.match(current.encrypt('Versión nueva', 'rotation-context'), /^v2\./);
});

test('clinical service denies roles without the explicit clinical capability', async () => {
  const repository = {} as ClinicalRecordRepository;
  const config = createTestConfig('postgresql://unused', 'clinical-unit');
  const service = new ClinicalRecordService(repository, { now: () => new Date() }, config.clinical);

  await assert.rejects(
    async () => service.listPatients({
      sessionId: 'session',
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'admin@example.test',
        displayName: 'Administrator',
        photoUrl: null,
        status: 'ACTIVE',
        roles: ['administrator'],
        psychologistVerificationStatus: null,
        capabilities: ['psychologist_verification:manage'],
      },
    }, { limit: 20 }),
    (error: unknown) => error instanceof AppError
      && error.status === 403
      && error.code === 'CLINICAL_CAPABILITY_REQUIRED'
  );
});

test('clinical service rejects future encounters before reaching persistence', async () => {
  let persisted = false;
  const repository = {
    createEncounter: async () => { persisted = true; throw new Error('should not execute'); },
  } as unknown as ClinicalRecordRepository;
  const config = createTestConfig('postgresql://unused', 'clinical-unit-time');
  const now = new Date('2026-08-28T12:00:00.000Z');
  const service = new ClinicalRecordService(repository, { now: () => now }, config.clinical);

  await assert.rejects(
    async () => service.createEncounter({
      sessionId: 'session',
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'psychologist@example.test',
        displayName: 'Psychologist',
        photoUrl: null,
        status: 'ACTIVE',
        roles: ['psychologist'],
        psychologistVerificationStatus: 'VERIFIED',
        capabilities: ['clinical:write:authorized'],
      },
    }, {
      patientUserId: '00000000-0000-4000-8000-000000000002',
      startedAt: new Date('2026-08-28T13:00:00.000Z'),
      noteContent: 'Contenido válido',
    }, '00000000-0000-4000-8000-000000000003', {
      actorUserId: '00000000-0000-4000-8000-000000000001',
    }),
    (error: unknown) => error instanceof AppError && error.code === 'VALIDATION_ERROR'
  );
  assert.equal(persisted, false);
});
