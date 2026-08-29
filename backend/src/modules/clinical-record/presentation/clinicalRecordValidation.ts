import { AppConfig } from '../../../config/env';
import { AppError, FieldError } from '../../../shared/domain/appError';
import {
  AmendNoteCommand,
  CreateEncounterCommand,
  CreateTreatmentPlanCommand,
  SignNoteCommand,
  UpdateDraftCommand,
} from '../application/ports';
import {
  ClinicalPageQuery,
  EncounterCursor,
  PatientCursor,
  TREATMENT_GOAL_STATUSES,
  TREATMENT_PLAN_TRANSITIONS,
  TreatmentGoalStatusValue,
  TreatmentPlanTransition,
} from '../domain/clinicalRecordTypes';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function objectBody(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw AppError.validation([{
      field: 'body',
      code: 'INVALID_BODY',
      message: 'Debe ser un objeto JSON.',
    }]);
  }
  return value as Record<string, unknown>;
}

function rejectUnknown(record: Record<string, unknown>, allowed: readonly string[]): FieldError[] {
  return Object.keys(record)
    .filter((field) => !allowed.includes(field))
    .map((field) => ({
      field,
      code: 'UNKNOWN_FIELD',
      message: 'Este campo no está permitido.',
    }));
}

export function parseClinicalUuid(value: string | undefined, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw AppError.validation([{ field, code: 'INVALID_UUID', message: 'Identificador no válido.' }]);
  }
  return value.toLowerCase();
}

export function parseClinicalIdempotencyKey(value: string | undefined): string {
  if (!value || !UUID_PATTERN.test(value.trim())) {
    throw AppError.validation([{
      field: 'Idempotency-Key',
      code: 'INVALID_IDEMPOTENCY_KEY',
      message: 'La cabecera Idempotency-Key debe contener un UUID.',
    }]);
  }
  return value.trim().toLowerCase();
}

function parseInstant(value: unknown, field: string, required = true): Date | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || value.length > 40) {
    throw AppError.validation([{ field, code: 'INVALID_INSTANT', message: 'Fecha y hora no válida.' }]);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !value.includes('T')) {
    throw AppError.validation([{ field, code: 'INVALID_INSTANT', message: 'Fecha y hora no válida.' }]);
  }
  return parsed;
}

function parseOptionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    throw AppError.validation([{ field, code: 'INVALID_DATE', message: 'La fecha debe usar YYYY-MM-DD.' }]);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw AppError.validation([{ field, code: 'INVALID_DATE', message: 'La fecha no es válida.' }]);
  }
  return parsed;
}

function requiredText(
  value: unknown,
  field: string,
  maximum: number,
  errors: FieldError[],
  minimum = 1
): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length < minimum || text.length > maximum) {
    errors.push({
      field,
      code: 'INVALID_LENGTH',
      message: `Debe contener entre ${minimum} y ${maximum} caracteres.`,
    });
  }
  return text;
}

function optionalText(value: unknown, field: string, maximum: number, errors: FieldError[]) {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredText(value, field, maximum, errors);
}

function expectedVersion(value: unknown, errors: FieldError[]): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 2_147_483_647) {
    errors.push({
      field: 'expectedVersion',
      code: 'INVALID_VERSION',
      message: 'La versión esperada debe ser un entero positivo.',
    });
  }
  return parsed;
}

function parseLimit(value: unknown, config: AppConfig['clinical']): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const limit = raw === undefined ? config.defaultPageSize : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > config.maximumPageSize) {
    throw AppError.validation([{ field: 'limit', code: 'INVALID_LIMIT', message: 'Límite no válido.' }]);
  }
  return limit;
}

function decodeCursor(value: unknown): Record<string, unknown> | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string' || raw.length > 500) {
    throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
  }
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as unknown;
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) throw new Error();
    return decoded as Record<string, unknown>;
  } catch {
    throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
  }
}

export function parsePatientPageQuery(
  query: Record<string, unknown>,
  config: AppConfig['clinical']
): ClinicalPageQuery<PatientCursor> {
  const unknown = Object.keys(query).filter((field) => !['limit', 'cursor'].includes(field));
  if (unknown.length) throw AppError.validation(rejectUnknown(query, ['limit', 'cursor']));
  const decoded = decodeCursor(query.cursor);
  let cursor: PatientCursor | undefined;
  if (decoded) {
    if (
      typeof decoded.normalizedName !== 'string'
      || decoded.normalizedName.length > 160
      || typeof decoded.id !== 'string'
      || !UUID_PATTERN.test(decoded.id)
    ) {
      throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
    }
    cursor = { normalizedName: decoded.normalizedName, id: decoded.id.toLowerCase() };
  }
  return { limit: parseLimit(query.limit, config), ...(cursor ? { cursor } : {}) };
}

export function parseEncounterPageQuery(
  query: Record<string, unknown>,
  config: AppConfig['clinical']
): ClinicalPageQuery<EncounterCursor> {
  const unknown = Object.keys(query).filter((field) => !['limit', 'cursor'].includes(field));
  if (unknown.length) throw AppError.validation(rejectUnknown(query, ['limit', 'cursor']));
  const decoded = decodeCursor(query.cursor);
  let cursor: EncounterCursor | undefined;
  if (decoded) {
    const startedAt = new Date(String(decoded.startedAt));
    if (
      Number.isNaN(startedAt.getTime())
      || typeof decoded.id !== 'string'
      || !UUID_PATTERN.test(decoded.id)
    ) {
      throw AppError.validation([{ field: 'cursor', code: 'INVALID_CURSOR', message: 'Cursor no válido.' }]);
    }
    cursor = { startedAt, id: decoded.id.toLowerCase() };
  }
  return { limit: parseLimit(query.limit, config), ...(cursor ? { cursor } : {}) };
}

export function parseCreateEncounter(
  body: unknown,
  config: AppConfig['clinical']
): CreateEncounterCommand {
  const record = objectBody(body);
  const errors = rejectUnknown(record, [
    'patientUserId', 'appointmentId', 'startedAt', 'endedAt', 'reason', 'noteContent',
  ]);
  let patientUserId = '';
  try { patientUserId = parseClinicalUuid(String(record.patientUserId ?? ''), 'patientUserId'); }
  catch (error) { if (error instanceof AppError && error.errors) errors.push(...error.errors); else throw error; }
  let appointmentId: string | undefined;
  if (record.appointmentId !== undefined && record.appointmentId !== null && record.appointmentId !== '') {
    try { appointmentId = parseClinicalUuid(String(record.appointmentId), 'appointmentId'); }
    catch (error) { if (error instanceof AppError && error.errors) errors.push(...error.errors); else throw error; }
  }
  let startedAt: Date | undefined;
  let endedAt: Date | undefined;
  try { startedAt = parseInstant(record.startedAt, 'startedAt'); }
  catch (error) { if (error instanceof AppError && error.errors) errors.push(...error.errors); else throw error; }
  try { endedAt = parseInstant(record.endedAt, 'endedAt', false); }
  catch (error) { if (error instanceof AppError && error.errors) errors.push(...error.errors); else throw error; }
  const reason = optionalText(
    record.reason,
    'reason',
    config.maximumEncounterReasonLength,
    errors
  );
  const noteContent = requiredText(
    record.noteContent,
    'noteContent',
    config.maximumNoteLength,
    errors
  );
  if (errors.length || !startedAt) throw AppError.validation(errors);
  return {
    patientUserId,
    ...(appointmentId ? { appointmentId } : {}),
    startedAt,
    ...(endedAt ? { endedAt } : {}),
    ...(reason ? { reason } : {}),
    noteContent,
  };
}

export function parseUpdateDraft(body: unknown, config: AppConfig['clinical']): UpdateDraftCommand {
  const record = objectBody(body);
  const errors = rejectUnknown(record, ['expectedVersion', 'content']);
  const version = expectedVersion(record.expectedVersion, errors);
  const content = requiredText(record.content, 'content', config.maximumNoteLength, errors);
  if (errors.length) throw AppError.validation(errors);
  return { expectedVersion: version, content };
}

export function parseSignNote(body: unknown): SignNoteCommand {
  const record = objectBody(body);
  const errors = rejectUnknown(record, ['expectedVersion']);
  const version = expectedVersion(record.expectedVersion, errors);
  if (errors.length) throw AppError.validation(errors);
  return { expectedVersion: version };
}

export function parseAmendNote(body: unknown, config: AppConfig['clinical']): AmendNoteCommand {
  const record = objectBody(body);
  const errors = rejectUnknown(record, ['expectedVersion', 'content', 'reason']);
  const version = expectedVersion(record.expectedVersion, errors);
  const content = requiredText(record.content, 'content', config.maximumNoteLength, errors);
  const reason = requiredText(
    record.reason,
    'reason',
    config.maximumAmendmentReasonLength,
    errors,
    config.minimumAmendmentReasonLength
  );
  if (errors.length) throw AppError.validation(errors);
  return { expectedVersion: version, content, reason };
}

export function parseCreateTreatmentPlan(
  body: unknown,
  config: AppConfig['clinical']
): CreateTreatmentPlanCommand {
  const record = objectBody(body);
  const errors = rejectUnknown(record, ['patientUserId', 'summary', 'startsAt', 'goals']);
  let patientUserId = '';
  try { patientUserId = parseClinicalUuid(String(record.patientUserId ?? ''), 'patientUserId'); }
  catch (error) { if (error instanceof AppError && error.errors) errors.push(...error.errors); else throw error; }
  const summary = requiredText(
    record.summary,
    'summary',
    config.maximumTreatmentSummaryLength,
    errors
  );
  let startsAt: Date | undefined;
  try { startsAt = parseInstant(record.startsAt, 'startsAt', false); }
  catch (error) { if (error instanceof AppError && error.errors) errors.push(...error.errors); else throw error; }
  const rawGoals = Array.isArray(record.goals) ? record.goals : [];
  if (rawGoals.length < 1 || rawGoals.length > config.maximumGoalsPerPlan) {
    errors.push({
      field: 'goals',
      code: 'INVALID_GOAL_COUNT',
      message: `Debe incluir entre 1 y ${config.maximumGoalsPerPlan} objetivos.`,
    });
  }
  const goals = rawGoals.map((value, index) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({ field: `goals.${index}`, code: 'INVALID_GOAL', message: 'Objetivo no válido.' });
      return { description: '' };
    }
    const goal = value as Record<string, unknown>;
    errors.push(...rejectUnknown(goal, ['description', 'targetDate']).map((error) => ({
      ...error,
      field: `goals.${index}.${error.field}`,
    })));
    const description = requiredText(
      goal.description,
      `goals.${index}.description`,
      config.maximumGoalLength,
      errors
    );
    let targetDate: Date | undefined;
    try { targetDate = parseOptionalDate(goal.targetDate, `goals.${index}.targetDate`); }
    catch (error) { if (error instanceof AppError && error.errors) errors.push(...error.errors); else throw error; }
    return { description, ...(targetDate ? { targetDate } : {}) };
  });
  if (errors.length) throw AppError.validation(errors);
  return { patientUserId, summary, ...(startsAt ? { startsAt } : {}), goals };
}

export function parsePlanTransition(body: unknown): TreatmentPlanTransition {
  const record = objectBody(body);
  const errors = rejectUnknown(record, ['transition']);
  if (!TREATMENT_PLAN_TRANSITIONS.includes(record.transition as TreatmentPlanTransition)) {
    errors.push({ field: 'transition', code: 'INVALID_TRANSITION', message: 'Transición no válida.' });
  }
  if (errors.length) throw AppError.validation(errors);
  return record.transition as TreatmentPlanTransition;
}

export function parseGoalStatus(body: unknown): TreatmentGoalStatusValue {
  const record = objectBody(body);
  const errors = rejectUnknown(record, ['status']);
  if (!TREATMENT_GOAL_STATUSES.includes(record.status as TreatmentGoalStatusValue)) {
    errors.push({ field: 'status', code: 'INVALID_GOAL_STATUS', message: 'Estado no válido.' });
  }
  if (errors.length) throw AppError.validation(errors);
  return record.status as TreatmentGoalStatusValue;
}
