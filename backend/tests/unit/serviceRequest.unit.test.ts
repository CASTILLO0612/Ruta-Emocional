import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  assertEmptyBody,
  parseCreateServiceRequest,
  parseEligiblePageQuery,
  parseIdempotencyKey,
  parseOfferBody,
  parsePageQuery,
} from '../../src/modules/service-request/presentation/serviceRequestValidation';
import { AppError } from '../../src/shared/domain/appError';
import { createTestConfig } from '../support/testConfig';

const policy = createTestConfig(
  'postgresql://integration.invalid/ruta_emocional',
  'service-request-unit'
).requestFlow;

test('request validation accepts the normalized API contract', () => {
  const scheduledFor = new Date(Date.now() + 86_400_000).toISOString();
  const parsed = parseCreateServiceRequest({
    modality: 'CALL',
    primaryNeed: '  Ansiedad  ',
    description: '  Necesito acompañamiento.  ',
    proposedBudget: { amount: '650.00', currency: 'nio' },
    timing: { kind: 'SCHEDULED', scheduledFor },
    location: { latitude: 12.12, longitude: -86.25 },
  }, policy);

  assert.equal(parsed.modality, 'CALL');
  assert.equal(parsed.primaryNeed, 'Ansiedad');
  assert.equal(parsed.description, 'Necesito acompañamiento.');
  assert.deepEqual(parsed.proposedBudget, { amount: '650.00', currency: 'NIO' });
  assert.equal(parsed.scheduledFor?.toISOString(), scheduledFor);
});

test('request validation rejects client-authored identity and unsupported money', () => {
  assert.throws(
    () => parseCreateServiceRequest({
      patientId: randomUUID(),
      patientName: 'Forged Patient',
      modality: 'CHAT',
      proposedBudget: { amount: '10.00', currency: 'USD' },
      timing: { kind: 'IMMEDIATE' },
    }, policy),
    (error: unknown) => error instanceof AppError
      && error.status === 422
      && error.errors?.filter(({ code }) => code === 'UNKNOWN_FIELD').length === 2
      && error.errors?.some(({ code }) => code === 'AMOUNT_OUT_OF_RANGE') === true
      && error.errors?.some(({ code }) => code === 'UNSUPPORTED_CURRENCY') === true
  );
});

test('offer validation accepts only a server-attributed offer payload', () => {
  assert.deepEqual(
    parseOfferBody({ price: { amount: '500.00' }, message: '  Disponible ahora.  ' }, policy),
    { amount: '500.00', message: 'Disponible ahora.' }
  );
  assert.throws(
    () => parseOfferBody({
      price: { amount: '500.00' },
      psychologistId: randomUUID(),
      psychologistRating: 5,
    }, policy),
    (error: unknown) => error instanceof AppError
      && error.errors?.filter(({ code }) => code === 'UNKNOWN_FIELD').length === 2
  );
});

test('idempotency, pagination and empty mutation bodies are fail closed', () => {
  const key = randomUUID();
  assert.equal(parseIdempotencyKey(key.toUpperCase()), key);
  assert.throws(() => parseIdempotencyKey('not-a-uuid'), AppError);
  assert.deepEqual(parsePageQuery({ limit: '10', status: 'BIDDING' }, policy), {
    limit: 10,
    status: 'BIDDING',
  });
  assert.throws(() => parsePageQuery({ limit: '500' }, policy), AppError);
  assert.throws(() => parseEligiblePageQuery({ status: 'ACCEPTED' }, policy), AppError);
  assert.doesNotThrow(() => assertEmptyBody({}));
  assert.throws(() => assertEmptyBody({ finalPrice: '1.00' }), AppError);
});
