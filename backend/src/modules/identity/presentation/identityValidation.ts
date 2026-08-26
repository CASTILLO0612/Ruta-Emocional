import { AppError, FieldError } from '../../../shared/domain/appError';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw AppError.validation([{ code: 'INVALID_BODY', message: 'El cuerpo debe ser un objeto JSON.' }]);
  }
  return value as Record<string, unknown>;
}

function rejectUnknownFields(record: Record<string, unknown>, allowed: readonly string[]): FieldError[] {
  const allowlist = new Set(allowed);
  return Object.keys(record)
    .filter((key) => !allowlist.has(key))
    .map((field) => ({ field, code: 'UNKNOWN_FIELD', message: 'Este campo no está permitido.' }));
}

function requiredString(
  record: Record<string, unknown>,
  field: string,
  minimum: number,
  maximum: number,
  errors: FieldError[]
): string {
  const value = record[field];
  if (typeof value !== 'string') {
    errors.push({ field, code: 'REQUIRED_STRING', message: 'Este campo es obligatorio.' });
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length < minimum || trimmed.length > maximum || CONTROL_CHARACTERS.test(trimmed)) {
    errors.push({
      field,
      code: 'INVALID_LENGTH_OR_CHARACTERS',
      message: `Debe contener entre ${minimum} y ${maximum} caracteres válidos.`,
    });
  }
  return trimmed;
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
  maximum: number,
  errors: FieldError[]
): string | undefined {
  const value = record[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim().length > maximum || CONTROL_CHARACTERS.test(value)) {
    errors.push({ field, code: 'INVALID_STRING', message: `Debe ser texto de hasta ${maximum} caracteres.` });
    return undefined;
  }
  return value.trim() || undefined;
}

function validateEmail(email: string, errors: FieldError[]): void {
  if (email.length > 320 || !EMAIL_PATTERN.test(email)) {
    errors.push({ field: 'email', code: 'INVALID_EMAIL', message: 'Ingresa un correo válido.' });
  }
}

function validatePassword(password: string, errors: FieldError[], requireStrength: boolean): void {
  const minimum = requireStrength ? 12 : 1;
  if (password.length < minimum || password.length > 128) {
    errors.push({
      field: 'password',
      code: requireStrength ? 'WEAK_PASSWORD' : 'INVALID_PASSWORD',
      message: requireStrength
        ? 'La contraseña debe contener entre 12 y 128 caracteres.'
        : 'La contraseña no es válida.',
    });
  }
}

function throwIfErrors(errors: FieldError[]): void {
  if (errors.length > 0) throw AppError.validation(errors);
}

export interface PatientRegistrationBody {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
}

export interface PsychologistRegistrationBody extends PatientRegistrationBody {
  readonly licenseAuthority: string;
  readonly licenseNumber: string;
}

export interface LoginBody {
  readonly email: string;
  readonly password: string;
  readonly deviceName?: string;
}

export function parsePatientRegistration(body: unknown): PatientRegistrationBody {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, ['displayName', 'email', 'password']);
  const displayName = requiredString(record, 'displayName', 2, 160, errors);
  const email = requiredString(record, 'email', 3, 320, errors).toLowerCase();
  const password = typeof record.password === 'string' ? record.password : '';
  if (typeof record.password !== 'string') {
    errors.push({ field: 'password', code: 'REQUIRED_STRING', message: 'Este campo es obligatorio.' });
  }
  validateEmail(email, errors);
  validatePassword(password, errors, true);
  throwIfErrors(errors);
  return { displayName, email, password };
}

export function parsePsychologistRegistration(body: unknown): PsychologistRegistrationBody {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, ['displayName', 'email', 'password', 'license']);
  const displayName = requiredString(record, 'displayName', 2, 160, errors);
  const email = requiredString(record, 'email', 3, 320, errors).toLowerCase();
  const password = typeof record.password === 'string' ? record.password : '';
  if (typeof record.password !== 'string') {
    errors.push({ field: 'password', code: 'REQUIRED_STRING', message: 'Este campo es obligatorio.' });
  }

  const license = record.license && typeof record.license === 'object' && !Array.isArray(record.license)
    ? record.license as Record<string, unknown>
    : {};
  if (!record.license || Object.keys(license).length === 0) {
    errors.push({ field: 'license', code: 'REQUIRED_OBJECT', message: 'La licencia es obligatoria.' });
  }
  errors.push(...rejectUnknownFields(license, ['authority', 'number']).map((error) => ({
    ...error,
    field: `license.${error.field}`,
  })));
  const licenseAuthority = requiredString(license, 'authority', 2, 120, errors);
  const licenseNumber = requiredString(license, 'number', 4, 80, errors);

  validateEmail(email, errors);
  validatePassword(password, errors, true);
  throwIfErrors(errors);
  return { displayName, email, password, licenseAuthority, licenseNumber };
}

export function parseLogin(body: unknown): LoginBody {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, ['email', 'password', 'deviceName']);
  const email = requiredString(record, 'email', 3, 320, errors).toLowerCase();
  const password = typeof record.password === 'string' ? record.password : '';
  if (typeof record.password !== 'string') {
    errors.push({ field: 'password', code: 'REQUIRED_STRING', message: 'Este campo es obligatorio.' });
  }
  const deviceName = optionalString(record, 'deviceName', 160, errors);
  validateEmail(email, errors);
  validatePassword(password, errors, false);
  throwIfErrors(errors);
  return { email, password, deviceName };
}

export function parseRefresh(body: unknown): string {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, ['refreshToken']);
  const refreshToken = requiredString(record, 'refreshToken', 40, 300, errors);
  throwIfErrors(errors);
  return refreshToken;
}

export interface LegacyRegistrationBody extends PatientRegistrationBody {
  readonly role: 'patient' | 'psychologist';
  readonly licenseNumber?: string;
}

export function parseLegacyRegistration(body: unknown): LegacyRegistrationBody {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, ['displayName', 'email', 'password', 'role', 'licenseNumber']);
  const displayName = requiredString(record, 'displayName', 2, 160, errors);
  const email = requiredString(record, 'email', 3, 320, errors).toLowerCase();
  const password = typeof record.password === 'string' ? record.password : '';
  const role = record.role;
  if (typeof record.password !== 'string') {
    errors.push({ field: 'password', code: 'REQUIRED_STRING', message: 'Este campo es obligatorio.' });
  }
  if (role !== 'patient' && role !== 'psychologist') {
    errors.push({ field: 'role', code: 'INVALID_ROLE', message: 'El tipo de cuenta no es válido.' });
  }
  const licenseNumber = optionalString(record, 'licenseNumber', 80, errors);
  if (role === 'psychologist' && (!licenseNumber || licenseNumber.length < 4)) {
    errors.push({ field: 'licenseNumber', code: 'INVALID_LICENSE', message: 'La licencia es obligatoria.' });
  }
  validateEmail(email, errors);
  validatePassword(password, errors, true);
  throwIfErrors(errors);
  return { displayName, email, password, role: role as 'patient' | 'psychologist', licenseNumber };
}
