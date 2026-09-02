import { AppConfig } from '../../../config/env';
import { AppError, FieldError } from '../../../shared/domain/appError';
import {
  DirectoryFilters,
  LOCAL_QA_EVIDENCE_CONTENT_TYPES,
  LocalQaEvidenceContentType,
  MODALITIES,
  ProfessionalModality,
  ProfessionalVerificationDecision,
  VERIFICATION_DECISIONS,
  WeeklyAvailabilityInput,
} from '../domain/professionalDirectoryTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_PATTERN = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const EVIDENCE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{7,511}$/;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function hasPrefix(bytes: Buffer, prefix: readonly number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((value, index) => bytes[index] === value);
}

function evidenceSignatureMatches(bytes: Buffer, contentType: LocalQaEvidenceContentType): boolean {
  if (contentType === 'application/pdf') return hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46, 0x2D]);
  if (contentType === 'image/png') {
    return hasPrefix(bytes, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  }
  return hasPrefix(bytes, [0xFF, 0xD8, 0xFF]);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw AppError.validation([{ code: 'INVALID_BODY', message: 'El cuerpo debe ser un objeto JSON.' }]);
  }
  return value as Record<string, unknown>;
}

function rejectUnknown(record: Record<string, unknown>, allowed: readonly string[]): FieldError[] {
  const allowlist = new Set(allowed);
  return Object.keys(record)
    .filter((key) => !allowlist.has(key))
    .map((field) => ({ field, code: 'UNKNOWN_FIELD', message: 'Este campo no está permitido.' }));
}

function stringValue(
  record: Record<string, unknown>,
  field: string,
  minimum: number,
  maximum: number,
  errors: FieldError[],
  optional = false
): string | undefined {
  const value = record[field];
  if (value === undefined && optional) return undefined;
  if (typeof value !== 'string') {
    errors.push({ field, code: 'REQUIRED_STRING', message: 'Este campo debe ser texto.' });
    return undefined;
  }
  const result = value.trim();
  if (result.length < minimum || result.length > maximum || CONTROL_CHARACTERS.test(result)) {
    errors.push({
      field,
      code: 'INVALID_STRING',
      message: `Debe contener entre ${minimum} y ${maximum} caracteres válidos.`,
    });
  }
  return result;
}

function booleanValue(record: Record<string, unknown>, field: string, errors: FieldError[]): boolean {
  if (typeof record[field] !== 'boolean') {
    errors.push({ field, code: 'REQUIRED_BOOLEAN', message: 'Este campo debe ser verdadero o falso.' });
    return false;
  }
  return record[field];
}

function throwIfErrors(errors: readonly FieldError[]): void {
  if (errors.length > 0) throw AppError.validation(errors);
}

function queryString(query: Record<string, unknown>, field: string, errors: FieldError[]): string | undefined {
  const value = query[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push({ field, code: 'INVALID_QUERY_VALUE', message: 'El parámetro debe tener un único valor.' });
    return undefined;
  }
  return value.trim();
}

function decimalQuery(value: string | undefined, field: string, errors: FieldError[]): string | undefined {
  if (value === undefined) return undefined;
  if (!MONEY_PATTERN.test(value) || Number(value) <= 0) {
    errors.push({ field, code: 'INVALID_MONEY', message: 'Ingresa un importe positivo con hasta dos decimales.' });
  }
  return value;
}

function finiteQuery(
  value: string | undefined,
  field: string,
  minimum: number,
  maximum: number,
  errors: FieldError[]
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) {
    errors.push({ field, code: 'INVALID_NUMBER', message: `Debe estar entre ${minimum} y ${maximum}.` });
  }
  return parsed;
}

function dateTime(value: string | undefined, field: string, errors: FieldError[]): Date | undefined {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(parsed.getTime())) {
    errors.push({ field, code: 'INVALID_DATE_TIME', message: 'Usa una fecha y hora ISO 8601 con zona.' });
    return undefined;
  }
  return parsed;
}

export function parseUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw AppError.validation([{ field, code: 'INVALID_UUID', message: 'El identificador no es válido.' }]);
  }
  return value.toLowerCase();
}

export function parseSpecialtyCode(value: unknown): string {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(code) || code.length > 60) {
    throw AppError.validation([{ field: 'code', code: 'INVALID_SPECIALTY_CODE', message: 'El código no es válido.' }]);
  }
  return code;
}

export function decodeCursor(value: string | undefined, field = 'cursor'): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as unknown;
    const record = asRecord(parsed);
    if (record.version !== 1 || typeof record.id !== 'string' || !UUID_PATTERN.test(record.id)) {
      throw new Error('invalid cursor payload');
    }
    return record.id.toLowerCase();
  } catch {
    throw AppError.validation([{ field, code: 'INVALID_CURSOR', message: 'El cursor no es válido.' }]);
  }
}

export function parseDirectoryQuery(
  query: Record<string, unknown>,
  config: AppConfig['professionalDirectory']
): DirectoryFilters {
  const allowed = [
    'specialty', 'modality', 'minPrice', 'maxPrice', 'availableFrom', 'availableUntil',
    'latitude', 'longitude', 'radiusKm', 'cursor', 'limit',
  ];
  const errors = rejectUnknown(query, allowed);
  const specialtyRaw = queryString(query, 'specialty', errors);
  const specialty = specialtyRaw?.toUpperCase();
  if (specialty && !CODE_PATTERN.test(specialty)) {
    errors.push({ field: 'specialty', code: 'INVALID_SPECIALTY_CODE', message: 'El código no es válido.' });
  }

  const modalityRaw = queryString(query, 'modality', errors)?.toUpperCase();
  const modality = modalityRaw && MODALITIES.includes(modalityRaw as ProfessionalModality)
    ? modalityRaw as ProfessionalModality
    : undefined;
  if (modalityRaw && !modality) {
    errors.push({ field: 'modality', code: 'INVALID_MODALITY', message: 'La modalidad no es válida.' });
  }

  const minPrice = decimalQuery(queryString(query, 'minPrice', errors), 'minPrice', errors);
  const maxPrice = decimalQuery(queryString(query, 'maxPrice', errors), 'maxPrice', errors);
  if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
    errors.push({ field: 'maxPrice', code: 'INVALID_PRICE_RANGE', message: 'El máximo debe ser mayor o igual al mínimo.' });
  }

  const availableFrom = dateTime(queryString(query, 'availableFrom', errors), 'availableFrom', errors);
  const availableUntil = dateTime(queryString(query, 'availableUntil', errors), 'availableUntil', errors);
  if ((availableFrom && !availableUntil) || (!availableFrom && availableUntil)) {
    errors.push({
      field: 'availableUntil',
      code: 'INCOMPLETE_AVAILABILITY_RANGE',
      message: 'Debes enviar el inicio y el fin de la ventana.',
    });
  }
  if (availableFrom && availableUntil) {
    const windowMs = availableUntil.getTime() - availableFrom.getTime();
    if (windowMs <= 0 || windowMs > config.maxAvailabilityWindowDays * 86_400_000) {
      errors.push({
        field: 'availableUntil',
        code: 'INVALID_AVAILABILITY_RANGE',
        message: `La ventana debe ser positiva y no superar ${config.maxAvailabilityWindowDays} días.`,
      });
    }
  }

  const latitude = finiteQuery(queryString(query, 'latitude', errors), 'latitude', -90, 90, errors);
  const longitude = finiteQuery(queryString(query, 'longitude', errors), 'longitude', -180, 180, errors);
  const radiusKm = finiteQuery(
    queryString(query, 'radiusKm', errors),
    'radiusKm',
    0.1,
    config.maxRadiusKm,
    errors
  );
  const locationCount = [latitude, longitude, radiusKm].filter((value) => value !== undefined).length;
  if (locationCount > 0 && locationCount < 3) {
    errors.push({
      field: 'location',
      code: 'INCOMPLETE_LOCATION_FILTER',
      message: 'Latitud, longitud y radio deben enviarse juntos.',
    });
  }

  const limitRaw = queryString(query, 'limit', errors);
  const limit = limitRaw === undefined ? config.defaultPageSize : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > config.maxPageSize) {
    errors.push({
      field: 'limit',
      code: 'INVALID_PAGE_SIZE',
      message: `Debe ser un entero entre 1 y ${config.maxPageSize}.`,
    });
  }
  const cursorRaw = queryString(query, 'cursor', errors);
  throwIfErrors(errors);

  return {
    specialty,
    modality,
    minPrice,
    maxPrice,
    availableFrom,
    availableUntil,
    latitude,
    longitude,
    radiusKm,
    cursor: decodeCursor(cursorRaw),
    limit,
  };
}

export function parseSpecialtyCreate(body: unknown): { code: string; name: string } {
  const record = asRecord(body);
  const errors = rejectUnknown(record, ['code', 'name']);
  const code = stringValue(record, 'code', 2, 60, errors)?.toUpperCase() ?? '';
  const name = stringValue(record, 'name', 2, 120, errors) ?? '';
  if (code && !CODE_PATTERN.test(code)) {
    errors.push({ field: 'code', code: 'INVALID_CODE', message: 'Usa letras, números y guiones bajos.' });
  }
  throwIfErrors(errors);
  return { code, name };
}

export function parseSpecialtyStatus(body: unknown): boolean {
  const record = asRecord(body);
  const errors = rejectUnknown(record, ['isActive']);
  const isActive = booleanValue(record, 'isActive', errors);
  throwIfErrors(errors);
  return isActive;
}

export function parseProfilePatch(body: unknown): { bio: string | null } {
  const record = asRecord(body);
  const errors = rejectUnknown(record, ['bio']);
  if (!Object.prototype.hasOwnProperty.call(record, 'bio')) {
    errors.push({ field: 'bio', code: 'REQUIRED_FIELD', message: 'Debes enviar el campo a actualizar.' });
  }
  const bioValue = record.bio;
  let bio: string | null = null;
  if (bioValue !== null) {
    bio = stringValue(record, 'bio', 20, 3000, errors) ?? null;
  }
  throwIfErrors(errors);
  return { bio };
}

export function parseSpecialtySelection(body: unknown): {
  specialtyCodes: readonly string[];
  primarySpecialtyCode: string;
} {
  const record = asRecord(body);
  const errors = rejectUnknown(record, ['specialtyCodes', 'primarySpecialtyCode']);
  const rawCodes = record.specialtyCodes;
  const specialtyCodes = Array.isArray(rawCodes)
    ? rawCodes.map((value) => typeof value === 'string' ? value.trim().toUpperCase() : '')
    : [];
  if (!Array.isArray(rawCodes) || specialtyCodes.length < 1 || specialtyCodes.length > 10) {
    errors.push({ field: 'specialtyCodes', code: 'INVALID_LIST', message: 'Selecciona entre 1 y 10 especialidades.' });
  }
  if (specialtyCodes.some((code) => !CODE_PATTERN.test(code)) || new Set(specialtyCodes).size !== specialtyCodes.length) {
    errors.push({ field: 'specialtyCodes', code: 'INVALID_CODES', message: 'Los códigos deben ser válidos y únicos.' });
  }
  const primarySpecialtyCode = stringValue(record, 'primarySpecialtyCode', 2, 60, errors)?.toUpperCase() ?? '';
  if (!specialtyCodes.includes(primarySpecialtyCode)) {
    errors.push({
      field: 'primarySpecialtyCode',
      code: 'PRIMARY_NOT_SELECTED',
      message: 'La especialidad principal debe estar incluida en la selección.',
    });
  }
  throwIfErrors(errors);
  return { specialtyCodes, primarySpecialtyCode };
}

export function parseModality(value: unknown): ProfessionalModality {
  const normalized = typeof value === 'string' ? value.toUpperCase() : '';
  if (!MODALITIES.includes(normalized as ProfessionalModality)) {
    throw AppError.validation([{ field: 'modality', code: 'INVALID_MODALITY', message: 'La modalidad no es válida.' }]);
  }
  return normalized as ProfessionalModality;
}

export function parseModalityConfiguration(
  body: unknown,
  supportedCurrencies: readonly string[]
): { amount: string; currency: string; isEnabled: boolean } {
  const record = asRecord(body);
  const errors = rejectUnknown(record, ['pricePerHour', 'isEnabled']);
  const price = record.pricePerHour && typeof record.pricePerHour === 'object' && !Array.isArray(record.pricePerHour)
    ? record.pricePerHour as Record<string, unknown>
    : {};
  if (Object.keys(price).length === 0) {
    errors.push({ field: 'pricePerHour', code: 'REQUIRED_OBJECT', message: 'El precio es obligatorio.' });
  }
  errors.push(...rejectUnknown(price, ['amount', 'currency']).map((error) => ({
    ...error,
    field: `pricePerHour.${error.field}`,
  })));
  const amount = stringValue(price, 'amount', 1, 13, errors) ?? '';
  const currency = stringValue(price, 'currency', 3, 3, errors)?.toUpperCase() ?? '';
  const isEnabled = booleanValue(record, 'isEnabled', errors);
  if (!MONEY_PATTERN.test(amount) || Number(amount) <= 0) {
    errors.push({ field: 'pricePerHour.amount', code: 'INVALID_MONEY', message: 'El importe debe ser positivo.' });
  }
  if (!CURRENCY_PATTERN.test(currency) || !supportedCurrencies.includes(currency)) {
    errors.push({ field: 'pricePerHour.currency', code: 'UNSUPPORTED_CURRENCY', message: 'La moneda no está habilitada.' });
  }
  throwIfErrors(errors);
  return { amount, currency, isEnabled };
}

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function parseWeeklyAvailability(
  body: unknown,
  maxRules: number
): { timezone: string; rules: readonly WeeklyAvailabilityInput[] } {
  const record = asRecord(body);
  const errors = rejectUnknown(record, ['timezone', 'rules']);
  const timezone = stringValue(record, 'timezone', 1, 80, errors) ?? '';
  if (timezone && !validTimeZone(timezone)) {
    errors.push({ field: 'timezone', code: 'INVALID_TIMEZONE', message: 'Usa una zona horaria IANA válida.' });
  }
  if (!Array.isArray(record.rules) || record.rules.length > maxRules) {
    errors.push({ field: 'rules', code: 'INVALID_LIST', message: `Envía una lista de hasta ${maxRules} reglas.` });
  }
  const rules: WeeklyAvailabilityInput[] = [];
  if (Array.isArray(record.rules)) {
    record.rules.forEach((value, index) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        errors.push({ field: `rules.${index}`, code: 'INVALID_RULE', message: 'La regla debe ser un objeto.' });
        return;
      }
      const rule = value as Record<string, unknown>;
      errors.push(...rejectUnknown(rule, [
        'weekday', 'startTime', 'endTime', 'effectiveFrom', 'effectiveUntil', 'isActive',
      ]).map((error) => ({ ...error, field: `rules.${index}.${error.field}` })));
      const weekday = rule.weekday;
      const startTime = typeof rule.startTime === 'string' ? rule.startTime : '';
      const endTime = typeof rule.endTime === 'string' ? rule.endTime : '';
      const effectiveFrom = typeof rule.effectiveFrom === 'string' ? rule.effectiveFrom : undefined;
      const effectiveUntil = typeof rule.effectiveUntil === 'string' ? rule.effectiveUntil : undefined;
      const isActive = typeof rule.isActive === 'boolean' ? rule.isActive : true;
      if (!Number.isInteger(weekday) || Number(weekday) < 0 || Number(weekday) > 6) {
        errors.push({ field: `rules.${index}.weekday`, code: 'INVALID_WEEKDAY', message: 'Debe estar entre 0 y 6.' });
      }
      if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime) || startTime >= endTime) {
        errors.push({ field: `rules.${index}.time`, code: 'INVALID_TIME_RANGE', message: 'El intervalo horario no es válido.' });
      }
      if (effectiveFrom && !DATE_PATTERN.test(effectiveFrom)) {
        errors.push({ field: `rules.${index}.effectiveFrom`, code: 'INVALID_DATE', message: 'Usa YYYY-MM-DD.' });
      }
      if (effectiveUntil && !DATE_PATTERN.test(effectiveUntil)) {
        errors.push({ field: `rules.${index}.effectiveUntil`, code: 'INVALID_DATE', message: 'Usa YYYY-MM-DD.' });
      }
      if (effectiveFrom && effectiveUntil && effectiveFrom > effectiveUntil) {
        errors.push({ field: `rules.${index}.effectiveUntil`, code: 'INVALID_DATE_RANGE', message: 'El fin no puede preceder al inicio.' });
      }
      rules.push({
        weekday: Number(weekday),
        startTime,
        endTime,
        ...(effectiveFrom ? { effectiveFrom } : {}),
        ...(effectiveUntil ? { effectiveUntil } : {}),
        isActive,
      });
    });
  }
  throwIfErrors(errors);
  return { timezone, rules };
}

export function parseAvailabilityException(body: unknown): {
  startsAt: Date;
  endsAt: Date;
  type: 'AVAILABLE' | 'UNAVAILABLE';
  reason?: string;
} {
  const record = asRecord(body);
  const errors = rejectUnknown(record, ['startsAt', 'endsAt', 'type', 'reason']);
  const startsAt = dateTime(stringValue(record, 'startsAt', 20, 40, errors), 'startsAt', errors);
  const endsAt = dateTime(stringValue(record, 'endsAt', 20, 40, errors), 'endsAt', errors);
  const type = stringValue(record, 'type', 9, 11, errors);
  const reason = stringValue(record, 'reason', 1, 240, errors, true);
  if (type !== 'AVAILABLE' && type !== 'UNAVAILABLE') {
    errors.push({ field: 'type', code: 'INVALID_EXCEPTION_TYPE', message: 'El tipo no es válido.' });
  }
  if (startsAt && endsAt && startsAt >= endsAt) {
    errors.push({ field: 'endsAt', code: 'INVALID_DATE_RANGE', message: 'El fin debe ser posterior al inicio.' });
  }
  throwIfErrors(errors);
  return { startsAt: startsAt!, endsAt: endsAt!, type: type as 'AVAILABLE' | 'UNAVAILABLE', reason };
}

export function parseEvidenceSubmission(body: unknown): { licenseId: string; evidenceObjectKey: string } {
  const record = asRecord(body);
  const errors = rejectUnknown(record, ['licenseId', 'evidenceObjectKey']);
  let licenseId = '';
  try {
    licenseId = parseUuid(record.licenseId, 'licenseId');
  } catch (error) {
    if (error instanceof AppError && error.errors) errors.push(...error.errors);
    else throw error;
  }
  const evidenceObjectKey = stringValue(record, 'evidenceObjectKey', 8, 512, errors) ?? '';
  if (evidenceObjectKey && !EVIDENCE_KEY_PATTERN.test(evidenceObjectKey)) {
    errors.push({
      field: 'evidenceObjectKey',
      code: 'INVALID_EVIDENCE_REFERENCE',
      message: 'La referencia privada del archivo no es válida.',
    });
  }
  throwIfErrors(errors);
  return { licenseId, evidenceObjectKey };
}

export function parseLocalQaEvidenceUpload(input: {
  readonly body: unknown;
  readonly contentType: string | undefined;
  readonly encodedFileName: string | undefined;
  readonly maximumBytes: number;
}): {
  readonly bytes: Buffer;
  readonly contentType: LocalQaEvidenceContentType;
  readonly originalFileName: string;
} {
  const errors: FieldError[] = [];
  const bytes = Buffer.isBuffer(input.body) ? input.body : Buffer.alloc(0);
  const normalizedContentType = input.contentType?.split(';', 1)[0].trim().toLowerCase() ?? '';
  const supportedContentType = LOCAL_QA_EVIDENCE_CONTENT_TYPES.includes(
    normalizedContentType as LocalQaEvidenceContentType
  ) ? normalizedContentType as LocalQaEvidenceContentType : undefined;

  let originalFileName = '';
  try {
    originalFileName = input.encodedFileName ? decodeURIComponent(input.encodedFileName).trim() : '';
  } catch {
    errors.push({ field: 'fileName', code: 'INVALID_FILE_NAME', message: 'El nombre del archivo no es válido.' });
  }
  if (
    originalFileName.length < 1
    || originalFileName.length > 180
    || CONTROL_CHARACTERS.test(originalFileName)
    || /[\\/]/.test(originalFileName)
  ) {
    errors.push({
      field: 'fileName',
      code: 'INVALID_FILE_NAME',
      message: 'El nombre debe contener entre 1 y 180 caracteres y no incluir rutas.',
    });
  }
  if (!supportedContentType) {
    errors.push({
      field: 'contentType',
      code: 'UNSUPPORTED_EVIDENCE_TYPE',
      message: 'Adjunta un archivo PDF, JPEG o PNG.',
    });
  }
  if (bytes.length < 1 || bytes.length > input.maximumBytes) {
    errors.push({
      field: 'file',
      code: 'INVALID_EVIDENCE_SIZE',
      message: `El archivo debe pesar entre 1 byte y ${input.maximumBytes} bytes.`,
    });
  }
  if (supportedContentType && bytes.length > 0 && !evidenceSignatureMatches(bytes, supportedContentType)) {
    errors.push({
      field: 'file',
      code: 'EVIDENCE_SIGNATURE_MISMATCH',
      message: 'El contenido del archivo no coincide con el tipo declarado.',
    });
  }
  throwIfErrors(errors);
  return { bytes, contentType: supportedContentType!, originalFileName };
}

export function parseVerificationDecision(body: unknown): {
  decision: ProfessionalVerificationDecision;
  publicReason?: string;
  internalReason?: string;
} {
  const record = asRecord(body);
  const errors = rejectUnknown(record, ['decision', 'publicReason', 'internalReason']);
  const decision = stringValue(record, 'decision', 8, 8, errors);
  const publicReason = stringValue(record, 'publicReason', 10, 500, errors, true);
  const internalReason = stringValue(record, 'internalReason', 1, 1000, errors, true);
  if (!VERIFICATION_DECISIONS.includes(decision as ProfessionalVerificationDecision)) {
    errors.push({ field: 'decision', code: 'INVALID_DECISION', message: 'La decisión no es válida.' });
  }
  if (decision === 'REJECTED' && !publicReason) {
    errors.push({ field: 'publicReason', code: 'REJECTION_REASON_REQUIRED', message: 'Explica qué debe corregir el profesional.' });
  }
  throwIfErrors(errors);
  return { decision: decision as ProfessionalVerificationDecision, publicReason, internalReason };
}

export function parseAdminListQuery(
  query: Record<string, unknown>,
  config: AppConfig['professionalDirectory']
): { cursor?: string; limit: number } {
  const errors = rejectUnknown(query, ['cursor', 'limit']);
  const cursorRaw = queryString(query, 'cursor', errors);
  const limitRaw = queryString(query, 'limit', errors);
  const limit = limitRaw === undefined ? config.defaultPageSize : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > config.maxPageSize) {
    errors.push({ field: 'limit', code: 'INVALID_PAGE_SIZE', message: `Debe estar entre 1 y ${config.maxPageSize}.` });
  }
  throwIfErrors(errors);
  return { cursor: decodeCursor(cursorRaw), limit };
}
