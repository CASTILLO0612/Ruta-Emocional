import { AppError, FieldError } from '../../../shared/domain/appError';
import type { MentaScope } from '../domain/mentaTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function asRecord(value: unknown, errors: FieldError[]): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  errors.push({ field: 'body', code: 'INVALID_OBJECT', message: 'El cuerpo debe ser un objeto.' });
  return {};
}

function rejectUnknownFields(
  record: Record<string, unknown>,
  allowed: readonly string[],
  errors: FieldError[]
): void {
  for (const field of Object.keys(record)) {
    if (!allowed.includes(field)) {
      errors.push({ field, code: 'UNKNOWN_FIELD', message: 'Este campo no está permitido.' });
    }
  }
}

export function parseMentaScope(value: unknown): MentaScope {
  if (value === 'PATIENT' || value === 'PSYCHOLOGIST') return value;
  throw AppError.validation([{
    field: 'scope',
    code: 'INVALID_MENTA_SCOPE',
    message: 'El contexto de MENTA no es válido.',
  }]);
}

export function parseOpenMentaConversation(body: unknown): {
  readonly scope: MentaScope;
  readonly consentGranted: boolean;
} {
  const errors: FieldError[] = [];
  const record = asRecord(body, errors);
  rejectUnknownFields(record, ['scope', 'consentGranted'], errors);

  let scope: MentaScope | undefined;
  if (record.scope === 'PATIENT' || record.scope === 'PSYCHOLOGIST') {
    scope = record.scope;
  } else {
    errors.push({
      field: 'scope',
      code: 'INVALID_MENTA_SCOPE',
      message: 'El contexto de MENTA no es válido.',
    });
  }
  if (record.consentGranted !== true) {
    errors.push({
      field: 'consentGranted',
      code: 'MENTA_CONSENT_REQUIRED',
      message: 'Debes aceptar el alcance informado antes de conversar con MENTA.',
    });
  }

  if (errors.length || !scope) throw AppError.validation(errors);
  return { scope, consentGranted: true };
}

export function parseMentaMessage(body: unknown): {
  readonly clientMessageId: string;
  readonly message: string;
} {
  const errors: FieldError[] = [];
  const record = asRecord(body, errors);
  rejectUnknownFields(record, ['clientMessageId', 'message'], errors);

  const clientMessageId = typeof record.clientMessageId === 'string'
    ? record.clientMessageId.trim().toLowerCase()
    : '';
  if (!UUID_PATTERN.test(clientMessageId)) {
    errors.push({
      field: 'clientMessageId',
      code: 'INVALID_UUID',
      message: 'El identificador del mensaje no es válido.',
    });
  }
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  if (!message) {
    errors.push({ field: 'message', code: 'REQUIRED', message: 'Escribe un mensaje.' });
  }

  if (errors.length) throw AppError.validation(errors);
  return { clientMessageId, message };
}

export function parseMentaUuid(value: string | undefined, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw AppError.validation([{ field, code: 'INVALID_UUID', message: 'El identificador no es válido.' }]);
  }
  return value.toLowerCase();
}
