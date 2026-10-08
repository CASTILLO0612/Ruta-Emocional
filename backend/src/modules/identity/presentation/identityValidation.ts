import { AppError, FieldError } from '../../../shared/domain/appError';
import type { ProfilePhotoContentType, ProfilePhotoFile } from '../application/ports';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;
const PROFILE_PHOTO_CONTENT_TYPES = new Set<ProfilePhotoContentType>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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

export interface GoogleLoginBody {
  readonly idToken: string;
  readonly registrationRole?: 'patient' | 'psychologist';
  readonly licenseAuthority?: string;
  readonly licenseNumber?: string;
  readonly deviceName?: string;
}

export interface PasswordResetRequestBody {
  readonly email: string;
}

export interface PasswordResetCompletionBody {
  readonly token: string;
  readonly password: string;
}

export interface UpdateOwnProfileBody {
  readonly displayName: string;
  readonly phone: string | null;
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

export function parseGoogleLogin(body: unknown): GoogleLoginBody {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, [
    'idToken',
    'registrationRole',
    'license',
    'deviceName',
  ]);
  const idToken = requiredString(record, 'idToken', 100, 16_384, errors);
  const deviceName = optionalString(record, 'deviceName', 160, errors);
  const registrationRole = record.registrationRole === 'patient' || record.registrationRole === 'psychologist'
    ? record.registrationRole
    : undefined;
  if (
    record.registrationRole !== undefined
    && record.registrationRole !== 'patient'
    && record.registrationRole !== 'psychologist'
  ) {
    errors.push({
      field: 'registrationRole',
      code: 'INVALID_ROLE',
      message: 'Selecciona un tipo de cuenta válido.',
    });
  }

  const license = record.license && typeof record.license === 'object' && !Array.isArray(record.license)
    ? record.license as Record<string, unknown>
    : undefined;
  let licenseAuthority: string | undefined;
  let licenseNumber: string | undefined;
  if (license) {
    errors.push(...rejectUnknownFields(license, ['authority', 'number']).map((error) => ({
      ...error,
      field: `license.${error.field}`,
    })));
    licenseAuthority = requiredString(license, 'authority', 2, 120, errors);
    licenseNumber = requiredString(license, 'number', 4, 80, errors);
  }
  if (registrationRole === 'psychologist' && !license) {
    errors.push({
      field: 'license',
      code: 'LICENSE_REQUIRED',
      message: 'La licencia profesional es obligatoria para crear esta cuenta.',
    });
  }
  throwIfErrors(errors);
  return {
    idToken,
    registrationRole,
    licenseAuthority,
    licenseNumber,
    deviceName,
  };
}

export function parsePasswordResetRequest(body: unknown): PasswordResetRequestBody {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, ['email']);
  const email = requiredString(record, 'email', 3, 320, errors).toLowerCase();
  validateEmail(email, errors);
  throwIfErrors(errors);
  return { email };
}

export function parsePasswordResetCompletion(body: unknown): PasswordResetCompletionBody {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, ['token', 'password']);
  const token = requiredString(record, 'token', 40, 200, errors);
  const password = typeof record.password === 'string' ? record.password : '';
  if (typeof record.password !== 'string') {
    errors.push({ field: 'password', code: 'REQUIRED_STRING', message: 'Este campo es obligatorio.' });
  }
  validatePassword(password, errors, true);
  throwIfErrors(errors);
  return { token, password };
}

export function parseRefresh(body: unknown): string {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, ['refreshToken']);
  const refreshToken = requiredString(record, 'refreshToken', 40, 300, errors);
  throwIfErrors(errors);
  return refreshToken;
}

export function parseUpdateOwnProfile(body: unknown): UpdateOwnProfileBody {
  const record = asRecord(body);
  const errors = rejectUnknownFields(record, ['displayName', 'phone']);
  const displayName = requiredString(record, 'displayName', 2, 160, errors);
  let phone: string | null = null;
  if (record.phone !== undefined && record.phone !== null && record.phone !== '') {
    if (typeof record.phone !== 'string') {
      errors.push({ field: 'phone', code: 'INVALID_PHONE', message: 'Ingresa un teléfono válido.' });
    } else {
      const compact = record.phone.trim().replace(/[\s()-]/g, '');
      if (!/^\+?\d{8,15}$/.test(compact)) {
        errors.push({ field: 'phone', code: 'INVALID_PHONE', message: 'Ingresa entre 8 y 15 dígitos.' });
      } else {
        phone = compact;
      }
    }
  }
  throwIfErrors(errors);
  return { displayName, phone };
}

export function parseProfilePhotoUpload(input: {
  readonly body: unknown;
  readonly contentType: string | undefined;
  readonly maximumBytes: number;
}): ProfilePhotoFile {
  const contentType = input.contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType || !PROFILE_PHOTO_CONTENT_TYPES.has(contentType as ProfilePhotoContentType)) {
    throw AppError.validation([{
      field: 'photo',
      code: 'UNSUPPORTED_PROFILE_PHOTO_TYPE',
      message: 'Utiliza una imagen JPEG, PNG o WebP.',
    }]);
  }
  if (!Buffer.isBuffer(input.body) || input.body.length === 0 || input.body.length > input.maximumBytes) {
    throw AppError.validation([{
      field: 'photo',
      code: 'INVALID_PROFILE_PHOTO_SIZE',
      message: 'La imagen está vacía o supera el tamaño permitido.',
    }]);
  }
  const bytes = input.body;
  const signatureMatches = contentType === 'image/jpeg'
    ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : contentType === 'image/png'
      ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.length >= 12
        && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
        && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!signatureMatches) {
    throw AppError.validation([{
      field: 'photo',
      code: 'PROFILE_PHOTO_SIGNATURE_MISMATCH',
      message: 'El contenido de la imagen no coincide con su formato.',
    }]);
  }
  return { contentType: contentType as ProfilePhotoContentType, bytes };
}
