import { AppConfig } from '../../../config/env';
import { AppError, FieldError } from '../../../shared/domain/appError';
import {
  APPOINTMENT_MODALITIES,
  APPOINTMENT_TRANSITIONS,
  AppointmentCursor,
  AppointmentModality,
  AppointmentPageQuery,
  AppointmentTransition,
} from '../domain/appointmentTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_WITH_ZONE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function recordValue(value: unknown, errors: FieldError[]): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  errors.push({ field: 'body', code: 'INVALID_OBJECT', message: 'El cuerpo debe ser un objeto.' });
  return {};
}

function rejectUnknown(record: Record<string, unknown>, allowed: readonly string[], errors: FieldError[]) {
  for (const field of Object.keys(record)) {
    if (!allowed.includes(field)) {
      errors.push({ field, code: 'UNKNOWN_FIELD', message: 'Este campo no está permitido.' });
    }
  }
}

export function parseAppointmentUuid(value: string | undefined, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw AppError.validation([{ field, code: 'INVALID_UUID', message: 'Identificador no válido.' }]);
  }
  return value.toLowerCase();
}

export function parseAppointmentIdempotencyKey(value: string | undefined): string {
  const key = value?.trim();
  if (!key || !UUID_PATTERN.test(key)) {
    throw AppError.badRequest(
      'IDEMPOTENCY_KEY_REQUIRED',
      'Idempotency-Key debe contener un UUID válido.'
    );
  }
  return key.toLowerCase();
}

function parseDate(value: unknown, field: string, errors: FieldError[]): Date {
  if (typeof value !== 'string' || !ISO_WITH_ZONE_PATTERN.test(value)) {
    errors.push({
      field,
      code: 'INVALID_DATE_TIME',
      message: 'Usa fecha y hora ISO 8601 con zona horaria explícita.',
    });
    return new Date(0);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ field, code: 'INVALID_DATE_TIME', message: 'La fecha no es válida.' });
    return new Date(0);
  }
  return parsed;
}

function parseModality(value: unknown, errors: FieldError[]): AppointmentModality {
  if (typeof value !== 'string' || !APPOINTMENT_MODALITIES.includes(value as AppointmentModality)) {
    errors.push({ field: 'modality', code: 'INVALID_MODALITY', message: 'Modalidad no válida.' });
    return 'CHAT';
  }
  return value as AppointmentModality;
}

export function parseCreateAppointment(body: unknown) {
  const errors: FieldError[] = [];
  const record = recordValue(body, errors);
  rejectUnknown(record, ['careRelationshipId', 'modality', 'startsAt'], errors);
  const careRelationshipId = typeof record.careRelationshipId === 'string'
    && UUID_PATTERN.test(record.careRelationshipId)
    ? record.careRelationshipId.toLowerCase()
    : '';
  if (!careRelationshipId) {
    errors.push({
      field: 'careRelationshipId',
      code: 'INVALID_UUID',
      message: 'Relación de atención no válida.',
    });
  }
  const modality = parseModality(record.modality, errors);
  const startsAt = parseDate(record.startsAt, 'startsAt', errors);
  if (errors.length) throw AppError.validation(errors);
  return { careRelationshipId, modality, startsAt };
}

export function parseSlotQuery(query: Record<string, unknown>) {
  const unknown = Object.keys(query).filter(
    (field) => !['careRelationshipId', 'modality', 'from', 'until'].includes(field)
  );
  const errors: FieldError[] = unknown.map((field) => ({
    field,
    code: 'UNKNOWN_FIELD',
    message: 'Este parámetro no está permitido.',
  }));
  const single = (value: unknown) => Array.isArray(value) ? value[0] : value;
  const relationship = single(query.careRelationshipId);
  const careRelationshipId = typeof relationship === 'string' && UUID_PATTERN.test(relationship)
    ? relationship.toLowerCase()
    : '';
  if (!careRelationshipId) {
    errors.push({ field: 'careRelationshipId', code: 'INVALID_UUID', message: 'Relación no válida.' });
  }
  const modality = parseModality(single(query.modality), errors);
  const from = parseDate(single(query.from), 'from', errors);
  const until = parseDate(single(query.until), 'until', errors);
  if (errors.length) throw AppError.validation(errors);
  return { careRelationshipId, modality, from, until };
}

function parseCursor(value: unknown): AppointmentCursor | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 500) {
    throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    const errors: FieldError[] = [];
    const startsAt = parseDate(decoded.startsAt, 'cursor', errors);
    if (errors.length || typeof decoded.id !== 'string' || !UUID_PATTERN.test(decoded.id)) throw new Error();
    return { startsAt, id: decoded.id.toLowerCase() };
  } catch {
    throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
  }
}

export function parseAppointmentPageQuery(
  query: Record<string, unknown>,
  policy: AppConfig['appointments']
): AppointmentPageQuery {
  const unknown = Object.keys(query).filter((field) => !['scope', 'cursor', 'limit'].includes(field));
  if (unknown.length) {
    throw AppError.validation(unknown.map((field) => ({
      field,
      code: 'UNKNOWN_FIELD',
      message: 'Este parámetro no está permitido.',
    })));
  }
  const single = (value: unknown) => Array.isArray(value) ? value[0] : value;
  const rawScope = single(query.scope) ?? 'UPCOMING';
  if (rawScope !== 'UPCOMING' && rawScope !== 'HISTORY') {
    throw AppError.validation([{ field: 'scope', code: 'INVALID_SCOPE', message: 'Usa UPCOMING o HISTORY.' }]);
  }
  const rawLimit = single(query.limit);
  const limit = rawLimit === undefined ? policy.defaultPageSize : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > policy.maximumPageSize) {
    throw AppError.validation([{ field: 'limit', code: 'INVALID_LIMIT', message: 'Límite no válido.' }]);
  }
  const cursor = parseCursor(single(query.cursor));
  return { scope: rawScope, limit, ...(cursor ? { cursor } : {}) };
}

export function parseTransition(
  body: unknown,
  policy: AppConfig['appointments']
): { transition: AppointmentTransition; reason?: string } {
  const errors: FieldError[] = [];
  const record = recordValue(body, errors);
  rejectUnknown(record, ['transition', 'reason'], errors);
  const transition = typeof record.transition === 'string'
    && APPOINTMENT_TRANSITIONS.includes(record.transition as AppointmentTransition)
    ? record.transition as AppointmentTransition
    : undefined;
  if (!transition) {
    errors.push({ field: 'transition', code: 'INVALID_TRANSITION', message: 'Transición no válida.' });
  }
  let reason: string | undefined;
  if (record.reason !== undefined) {
    if (typeof record.reason !== 'string') {
      errors.push({ field: 'reason', code: 'INVALID_STRING', message: 'El motivo debe ser texto.' });
    } else {
      reason = record.reason.trim();
      if (!reason || reason.length > policy.maximumCancellationReasonLength) {
        errors.push({
          field: 'reason',
          code: 'INVALID_LENGTH',
          message: `El motivo debe contener entre 1 y ${policy.maximumCancellationReasonLength} caracteres.`,
        });
      }
    }
  }
  if (transition === 'CANCEL' && !reason) {
    errors.push({ field: 'reason', code: 'CANCELLATION_REASON_REQUIRED', message: 'Indica el motivo.' });
  }
  if (transition !== 'CANCEL' && reason) {
    errors.push({ field: 'reason', code: 'UNEXPECTED_FIELD', message: 'Esta transición no admite motivo.' });
  }
  if (errors.length || !transition) throw AppError.validation(errors);
  return { transition, ...(reason ? { reason } : {}) };
}

export function parseReschedule(body: unknown): { startsAt: Date } {
  const errors: FieldError[] = [];
  const record = recordValue(body, errors);
  rejectUnknown(record, ['startsAt'], errors);
  const startsAt = parseDate(record.startsAt, 'startsAt', errors);
  if (errors.length) throw AppError.validation(errors);
  return { startsAt };
}
