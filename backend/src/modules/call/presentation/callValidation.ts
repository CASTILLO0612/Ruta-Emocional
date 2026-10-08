import { AppError } from '../../../shared/domain/appError';
import type { CallMediaType } from '../domain/callTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseCallUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw AppError.validation([{ field, code: 'INVALID_UUID', message: 'El identificador no es válido.' }]);
  }
  return value.toLowerCase();
}

export function parseCallMediaType(body: unknown): CallMediaType {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw AppError.validation([{ field: 'mediaType', code: 'REQUIRED', message: 'Selecciona audio o video.' }]);
  }
  const mediaType = (body as Record<string, unknown>).mediaType;
  if (mediaType !== 'AUDIO' && mediaType !== 'VIDEO') {
    throw AppError.validation([{ field: 'mediaType', code: 'INVALID', message: 'Selecciona audio o video.' }]);
  }
  return mediaType;
}
