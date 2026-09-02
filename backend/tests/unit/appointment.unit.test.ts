import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { AppError } from '../../src/shared/domain/appError';
import {
  parseAppointmentIdempotencyKey,
  parseAppointmentPageQuery,
  parseCreateAppointment,
  parseReschedule,
  parseSlotQuery,
  parseTransition,
} from '../../src/modules/appointment/presentation/appointmentValidation';
import { createTestConfig } from '../support/testConfig';

const policy = createTestConfig(
  'postgresql://integration.invalid/ruta_emocional',
  'appointment-unit'
).appointments;

test('appointment commands accept only relationship, modality and zoned instant', () => {
  const careRelationshipId = randomUUID();
  const startsAt = new Date(Date.now() + 86_400_000).toISOString();
  assert.deepEqual(parseCreateAppointment({
    careRelationshipId,
    modality: 'CALL',
    startsAt,
  }), {
    careRelationshipId,
    modality: 'CALL',
    startsAt: new Date(startsAt),
  });
  assert.throws(() => parseCreateAppointment({
    careRelationshipId,
    modality: 'CALL',
    startsAt,
    patientId: randomUUID(),
    durationMinutes: 180,
  }), (error: unknown) => error instanceof AppError
    && error.errors?.filter(({ code }) => code === 'UNKNOWN_FIELD').length === 2);
  assert.throws(() => parseCreateAppointment({
    careRelationshipId,
    modality: 'CALL',
    startsAt: '2026-09-01T10:00:00',
  }), AppError);
});

test('slot and page queries reject unbounded or ambiguous input', () => {
  const careRelationshipId = randomUUID();
  const from = new Date(Date.now() + 86_400_000).toISOString();
  const until = new Date(Date.now() + 172_800_000).toISOString();
  const slots = parseSlotQuery({ careRelationshipId, modality: 'CHAT', from, until });
  assert.equal(slots.careRelationshipId, careRelationshipId);
  assert.equal(slots.modality, 'CHAT');
  assert.equal(slots.from.toISOString(), from);
  assert.deepEqual(parseAppointmentPageQuery({ scope: 'UPCOMING', limit: '10' }, policy), {
    scope: 'UPCOMING',
    limit: 10,
  });
  assert.throws(() => parseAppointmentPageQuery({ scope: 'ALL' }, policy), AppError);
  assert.throws(() => parseAppointmentPageQuery({ limit: '500' }, policy), AppError);
});

test('transitions are closed commands and cancellation requires a reason', () => {
  assert.deepEqual(parseTransition({ transition: 'CONFIRM' }, policy), { transition: 'CONFIRM' });
  assert.deepEqual(parseTransition({
    transition: 'CANCEL',
    reason: '  Cambio de disponibilidad.  ',
  }, policy), {
    transition: 'CANCEL',
    reason: 'Cambio de disponibilidad.',
  });
  assert.throws(() => parseTransition({ transition: 'CANCEL' }, policy), AppError);
  assert.throws(() => parseTransition({ transition: 'CONFIRM', status: 'COMPLETED' }, policy), AppError);
  assert.throws(() => parseTransition({ transition: 'START', reason: 'forged' }, policy), AppError);
});

test('reschedule and idempotency parsing fail closed', () => {
  const key = randomUUID();
  const startsAt = new Date(Date.now() + 86_400_000).toISOString();
  assert.equal(parseAppointmentIdempotencyKey(key.toUpperCase()), key);
  assert.equal(parseReschedule({ startsAt }).startsAt.toISOString(), startsAt);
  assert.throws(() => parseAppointmentIdempotencyKey('retry-1'), AppError);
  assert.throws(() => parseReschedule({ startsAt, endsAt: startsAt }), AppError);
});
