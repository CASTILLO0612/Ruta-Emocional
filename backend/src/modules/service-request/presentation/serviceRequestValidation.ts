import { AppConfig } from '../../../config/env';
import { AppError, FieldError } from '../../../shared/domain/appError';
import {
  CreateServiceRequestInput,
  RequestCursor,
  RequestPageQuery,
  SERVICE_MODALITIES,
  SERVICE_REQUEST_STATUSES,
  ServiceModality,
  ServiceRequestStatus,
} from '../domain/serviceRequestTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MONEY_PATTERN = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/;

function recordValue(value: unknown, field: string, errors: FieldError[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    errors.push({ field, code: 'INVALID_OBJECT', message: 'Debe ser un objeto.' });
    return {};
  }
  return value as Record<string, unknown>;
}

function rejectUnknown(
  record: Record<string, unknown>,
  allowed: readonly string[],
  errors: FieldError[],
  prefix = ''
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      errors.push({
        field: `${prefix}${key}`,
        code: 'UNKNOWN_FIELD',
        message: 'Este campo no está permitido.',
      });
    }
  }
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
  maximum: number,
  errors: FieldError[]
): string | undefined {
  const value = record[field];
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') {
    errors.push({ field, code: 'INVALID_STRING', message: 'Debe ser texto.' });
    return undefined;
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    errors.push({
      field,
      code: 'INVALID_LENGTH',
      message: `Debe contener entre 1 y ${maximum} caracteres.`,
    });
    return undefined;
  }
  return normalized;
}

function decimalToMinorUnits(value: string): bigint {
  const [whole, decimal = ''] = value.split('.');
  return BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
}

function parseAmount(
  value: unknown,
  field: string,
  policy: AppConfig['requestFlow'],
  errors: FieldError[]
): string {
  if (typeof value !== 'string' || !MONEY_PATTERN.test(value)) {
    errors.push({
      field,
      code: 'INVALID_MONEY',
      message: 'Usa un decimal positivo con máximo dos decimales.',
    });
    return '';
  }
  const amount = decimalToMinorUnits(value);
  if (
    amount < decimalToMinorUnits(policy.minimumAmount)
    || amount > decimalToMinorUnits(policy.maximumAmount)
  ) {
    errors.push({
      field,
      code: 'AMOUNT_OUT_OF_RANGE',
      message: 'El monto está fuera de los límites configurados.',
    });
  }
  return value;
}

function parseModality(value: unknown, errors: FieldError[]): ServiceModality {
  if (typeof value !== 'string' || !SERVICE_MODALITIES.includes(value as ServiceModality)) {
    errors.push({ field: 'modality', code: 'INVALID_MODALITY', message: 'Modalidad no válida.' });
    return 'CHAT';
  }
  return value as ServiceModality;
}

function parseDate(value: unknown, field: string, errors: FieldError[]): Date | undefined {
  if (typeof value !== 'string') {
    errors.push({ field, code: 'INVALID_DATE_TIME', message: 'Debe usar fecha y hora ISO 8601.' });
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ field, code: 'INVALID_DATE_TIME', message: 'Debe usar fecha y hora ISO 8601.' });
    return undefined;
  }
  return parsed;
}

function parseCoordinate(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
  errors: FieldError[]
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
    errors.push({ field, code: 'INVALID_COORDINATE', message: 'Coordenada fuera de rango.' });
    return 0;
  }
  return value;
}

export function parseCreateServiceRequest(
  body: unknown,
  policy: AppConfig['requestFlow']
): CreateServiceRequestInput {
  const errors: FieldError[] = [];
  const record = recordValue(body, 'body', errors);
  rejectUnknown(
    record,
    ['modality', 'primaryNeed', 'description', 'proposedBudget', 'timing', 'location'],
    errors
  );

  const modality = parseModality(record.modality, errors);
  const primaryNeed = optionalString(
    record,
    'primaryNeed',
    policy.maximumPrimaryNeedLength,
    errors
  );
  const description = optionalString(
    record,
    'description',
    policy.maximumDescriptionLength,
    errors
  );

  const budget = recordValue(record.proposedBudget, 'proposedBudget', errors);
  rejectUnknown(budget, ['amount', 'currency'], errors, 'proposedBudget.');
  const amount = parseAmount(budget.amount, 'proposedBudget.amount', policy, errors);
  const currency = typeof budget.currency === 'string' ? budget.currency.trim().toUpperCase() : '';
  if (!policy.supportedCurrencies.includes(currency)) {
    errors.push({
      field: 'proposedBudget.currency',
      code: 'UNSUPPORTED_CURRENCY',
      message: 'La moneda no está habilitada.',
    });
  }

  const timing = recordValue(record.timing, 'timing', errors);
  rejectUnknown(timing, ['kind', 'scheduledFor'], errors, 'timing.');
  let scheduledFor: Date | undefined;
  if (timing.kind === 'SCHEDULED') {
    scheduledFor = parseDate(timing.scheduledFor, 'timing.scheduledFor', errors);
  } else if (timing.kind === 'IMMEDIATE') {
    if (timing.scheduledFor !== undefined) {
      errors.push({
        field: 'timing.scheduledFor',
        code: 'UNEXPECTED_FIELD',
        message: 'Una solicitud inmediata no incluye fecha programada.',
      });
    }
  } else {
    errors.push({
      field: 'timing.kind',
      code: 'INVALID_TIMING_KIND',
      message: 'Usa IMMEDIATE o SCHEDULED.',
    });
  }

  let location: CreateServiceRequestInput['location'];
  if (record.location !== undefined) {
    const locationRecord = recordValue(record.location, 'location', errors);
    rejectUnknown(locationRecord, ['latitude', 'longitude'], errors, 'location.');
    location = {
      latitude: parseCoordinate(locationRecord.latitude, 'location.latitude', -90, 90, errors),
      longitude: parseCoordinate(locationRecord.longitude, 'location.longitude', -180, 180, errors),
    };
  }

  if (errors.length) throw AppError.validation(errors);
  return {
    modality,
    ...(primaryNeed ? { primaryNeed } : {}),
    ...(description ? { description } : {}),
    proposedBudget: { amount, currency },
    ...(scheduledFor ? { scheduledFor } : {}),
    ...(location ? { location } : {}),
  };
}

export function parseOfferBody(
  body: unknown,
  policy: AppConfig['requestFlow']
): { amount: string; message?: string } {
  const errors: FieldError[] = [];
  const record = recordValue(body, 'body', errors);
  rejectUnknown(record, ['price', 'message'], errors);
  const price = recordValue(record.price, 'price', errors);
  rejectUnknown(price, ['amount'], errors, 'price.');
  const amount = parseAmount(price.amount, 'price.amount', policy, errors);
  const message = optionalString(record, 'message', policy.maximumOfferMessageLength, errors);
  if (errors.length) throw AppError.validation(errors);
  return { amount, ...(message ? { message } : {}) };
}

export function parseIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key || !UUID_PATTERN.test(key)) {
    throw AppError.badRequest(
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key debe contener un UUID válido.'
    );
  }
  return key.toLowerCase();
}

export function parseUuid(value: string | undefined, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw AppError.validation([{ field, code: 'INVALID_UUID', message: 'Identificador no válido.' }]);
  }
  return value.toLowerCase();
}

export function assertEmptyBody(body: unknown): void {
  if (body === undefined || body === null) return;
  if (typeof body === 'object' && !Array.isArray(body) && Object.keys(body).length === 0) return;
  throw AppError.validation([{
    field: 'body',
    code: 'UNEXPECTED_BODY',
    message: 'Esta operación no admite campos en el cuerpo.',
  }]);
}

function parseCursor(value: unknown): RequestCursor | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 500) {
    throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) throw new Error();
    const cursor = decoded as Record<string, unknown>;
    const createdAt = parseDate(cursor.createdAt, 'cursor', []);
    if (!createdAt || typeof cursor.id !== 'string' || !UUID_PATTERN.test(cursor.id)) throw new Error();
    return { createdAt, id: cursor.id.toLowerCase() };
  } catch {
    throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
  }
}

export function parsePageQuery(
  query: Record<string, unknown>,
  policy: AppConfig['requestFlow']
): RequestPageQuery {
  const unknown = Object.keys(query).filter((key) => !['cursor', 'limit', 'status'].includes(key));
  if (unknown.length) {
    throw AppError.validation(unknown.map((field) => ({
      field,
      code: 'UNKNOWN_FIELD',
      message: 'Este parámetro no está permitido.',
    })));
  }

  const rawLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;
  const limit = rawLimit === undefined ? policy.defaultPageSize : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > policy.maximumPageSize) {
    throw AppError.validation([{ field: 'limit', code: 'INVALID_LIMIT', message: 'Límite no válido.' }]);
  }

  const rawStatus = Array.isArray(query.status) ? query.status[0] : query.status;
  let status: ServiceRequestStatus | undefined;
  if (rawStatus !== undefined) {
    if (
      typeof rawStatus !== 'string'
      || !SERVICE_REQUEST_STATUSES.includes(rawStatus as ServiceRequestStatus)
    ) {
      throw AppError.validation([{ field: 'status', code: 'INVALID_STATUS', message: 'Estado no válido.' }]);
    }
    status = rawStatus as ServiceRequestStatus;
  }

  const rawCursor = Array.isArray(query.cursor) ? query.cursor[0] : query.cursor;
  const cursor = parseCursor(rawCursor);
  return {
    ...(cursor ? { cursor } : {}),
    limit,
    ...(status ? { status } : {}),
  };
}

export function parseEligiblePageQuery(
  query: Record<string, unknown>,
  policy: AppConfig['requestFlow']
): RequestPageQuery {
  const parsed = parsePageQuery(query, policy);
  if (parsed.status && parsed.status !== 'PENDING' && parsed.status !== 'BIDDING') {
    throw AppError.validation([{
      field: 'status',
      code: 'INVALID_ELIGIBLE_STATUS',
      message: 'Solo PENDING o BIDDING son estados elegibles.',
    }]);
  }
  return parsed;
}
