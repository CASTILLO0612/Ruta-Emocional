import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../../src/shared/domain/appError';
import {
  decodeCursor,
  parseDirectoryQuery,
  parseModalityConfiguration,
  parseWeeklyAvailability,
} from '../../src/modules/professional-directory/presentation/professionalDirectoryValidation';

const config = {
  defaultPageSize: 20,
  maxPageSize: 50,
  maxRadiusKm: 100,
  maxAvailabilityWindowDays: 31,
  maxWeeklyRules: 50,
  publicRequestsPerMinute: 120,
  supportedCurrencies: ['NIO'],
} as const;

test('directory validation rejects unknown fields and incomplete coordinates', () => {
  assert.throws(
    () => parseDirectoryQuery({ latitude: '12.1', hidden: 'value' }, config),
    (error: unknown) => error instanceof AppError
      && error.status === 422
      && error.errors?.some(({ code }) => code === 'UNKNOWN_FIELD') === true
      && error.errors?.some(({ code }) => code === 'INCOMPLETE_LOCATION_FILTER') === true
  );
});

test('directory validation accepts a bounded, complete filter set', () => {
  const result = parseDirectoryQuery({
    specialty: 'trauma',
    modality: 'call',
    minPrice: '100.00',
    maxPrice: '900',
    latitude: '12.12',
    longitude: '-86.25',
    radiusKm: '25',
    limit: '10',
  }, config);

  assert.equal(result.specialty, 'TRAUMA');
  assert.equal(result.modality, 'CALL');
  assert.equal(result.limit, 10);
  assert.equal(result.radiusKm, 25);
});

test('opaque cursor decoding rejects tampering', () => {
  const valid = Buffer.from(JSON.stringify({
    version: 1,
    id: '7f5c492b-54c4-4c85-98e4-c9375a486782',
  })).toString('base64url');
  assert.equal(decodeCursor(valid), '7f5c492b-54c4-4c85-98e4-c9375a486782');
  assert.throws(() => decodeCursor(`${valid}tampered`), AppError);
});

test('money and currency validation uses the configured allowlist', () => {
  assert.deepEqual(
    parseModalityConfiguration(
      { pricePerHour: { amount: '650.00', currency: 'nio' }, isEnabled: true },
      config.supportedCurrencies
    ),
    { amount: '650.00', currency: 'NIO', isEnabled: true }
  );
  assert.throws(
    () => parseModalityConfiguration(
      { pricePerHour: { amount: '650.00', currency: 'USD' }, isEnabled: true },
      config.supportedCurrencies
    ),
    AppError
  );
});

test('weekly availability validates timezone and interval ordering', () => {
  assert.deepEqual(
    parseWeeklyAvailability({
      timezone: 'America/Managua',
      rules: [{ weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true }],
    }, config.maxWeeklyRules).rules[0],
    { weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true }
  );
  assert.throws(
    () => parseWeeklyAvailability({
      timezone: 'Invalid/Timezone',
      rules: [{ weekday: 1, startTime: '12:00', endTime: '08:00', isActive: true }],
    }, config.maxWeeklyRules),
    AppError
  );
});
