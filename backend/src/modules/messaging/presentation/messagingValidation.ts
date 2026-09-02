import { AppConfig } from '../../../config/env';
import { AppError, FieldError } from '../../../shared/domain/appError';
import { CursorPosition, MessagePageQuery, PageQuery, SendMessageInput } from '../domain/messagingTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function recordValue(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw AppError.validation([{ field: 'body', code: 'INVALID_BODY', message: 'Debe ser un objeto JSON.' }]);
  }
  return value as Record<string, unknown>;
}

export function parseUuid(value: string | undefined, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw AppError.validation([{ field, code: 'INVALID_UUID', message: 'Identificador no válido.' }]);
  }
  return value.toLowerCase();
}

function parseCursor(value: unknown): CursorPosition | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > 500) {
    throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
  }
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) throw new Error();
    const record = decoded as Record<string, unknown>;
    const occurredAt = new Date(String(record.occurredAt));
    if (Number.isNaN(occurredAt.getTime()) || typeof record.id !== 'string' || !UUID_PATTERN.test(record.id)) {
      throw new Error();
    }
    return { occurredAt, id: record.id.toLowerCase() };
  } catch {
    throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
  }
}

function parseLimit(value: unknown, config: AppConfig['messaging']): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const limit = raw === undefined ? config.defaultPageSize : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > config.maximumPageSize) {
    throw AppError.validation([{ field: 'limit', code: 'INVALID_LIMIT', message: 'Límite no válido.' }]);
  }
  return limit;
}

export function parsePageQuery(
  query: Record<string, unknown>,
  config: AppConfig['messaging']
): PageQuery {
  const unknown = Object.keys(query).filter((key) => !['cursor', 'limit'].includes(key));
  if (unknown.length) {
    throw AppError.validation(unknown.map((field) => ({
      field,
      code: 'UNKNOWN_FIELD',
      message: 'Este parámetro no está permitido.',
    })));
  }
  const rawCursor = Array.isArray(query.cursor) ? query.cursor[0] : query.cursor;
  const cursor = parseCursor(rawCursor);
  return { limit: parseLimit(query.limit, config), ...(cursor ? { cursor } : {}) };
}

export function parseMessagePageQuery(
  query: Record<string, unknown>,
  config: AppConfig['messaging']
): MessagePageQuery {
  const unknown = Object.keys(query).filter((key) => !['cursor', 'limit', 'direction'].includes(key));
  if (unknown.length) {
    throw AppError.validation(unknown.map((field) => ({
      field,
      code: 'UNKNOWN_FIELD',
      message: 'Este parámetro no está permitido.',
    })));
  }
  const rawDirection = Array.isArray(query.direction) ? query.direction[0] : query.direction;
  const direction = rawDirection === undefined ? 'before' : rawDirection;
  if (direction !== 'before' && direction !== 'after') {
    throw AppError.validation([{
      field: 'direction',
      code: 'INVALID_DIRECTION',
      message: 'La dirección debe ser before o after.',
    }]);
  }
  const rawCursor = Array.isArray(query.cursor) ? query.cursor[0] : query.cursor;
  const cursor = parseCursor(rawCursor);
  if (direction === 'after' && !cursor) {
    throw AppError.validation([{
      field: 'cursor',
      code: 'CURSOR_REQUIRED',
      message: 'La dirección after requiere cursor.',
    }]);
  }
  return { direction, limit: parseLimit(query.limit, config), ...(cursor ? { cursor } : {}) };
}

export function parseSendMessage(
  body: unknown,
  config: AppConfig['messaging']
): SendMessageInput {
  const record = recordValue(body);
  const errors: FieldError[] = [];
  for (const field of Object.keys(record)) {
    if (!['clientMessageId', 'type', 'text'].includes(field)) {
      errors.push({ field, code: 'UNKNOWN_FIELD', message: 'Este campo no está permitido.' });
    }
  }
  const clientMessageId = typeof record.clientMessageId === 'string'
    ? record.clientMessageId.trim().toLowerCase()
    : '';
  if (!UUID_PATTERN.test(clientMessageId)) {
    errors.push({ field: 'clientMessageId', code: 'INVALID_UUID', message: 'Identificador no válido.' });
  }
  if (record.type !== 'TEXT') {
    errors.push({ field: 'type', code: 'UNSUPPORTED_MESSAGE_TYPE', message: 'Solo TEXT está habilitado.' });
  }
  const text = typeof record.text === 'string' ? record.text.trim() : '';
  if (!text || text.length > config.maximumTextLength) {
    errors.push({
      field: 'text',
      code: 'INVALID_MESSAGE_LENGTH',
      message: `El mensaje debe contener entre 1 y ${config.maximumTextLength} caracteres.`,
    });
  }
  if (errors.length) throw AppError.validation(errors);
  return { clientMessageId, type: 'TEXT', text };
}
