export const MINIMUM_PASSWORD_LENGTH = 12;
export const MINIMUM_LICENSE_NUMBER_LENGTH = 4;
export const MAXIMUM_LICENSE_NUMBER_LENGTH = 80;
export const MAXIMUM_PASSWORD_LENGTH = 128;
export const MAXIMUM_EMAIL_LENGTH = 320;
export const MINIMUM_NAME_LENGTH = 2;
export const MAXIMUM_NAME_LENGTH = 160;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PasswordStrengthResult {
  readonly level: 1 | 2 | 3;
  readonly label: 'Básica' | 'Media' | 'Fuerte';
}

export interface AuthValidationErrors {
  readonly name?: string;
  readonly email?: string;
  readonly password?: string;
  readonly passwordConfirmation?: string;
  readonly licenseNumber?: string;
}

export function isValidEmail(email: string): boolean {
  const normalized = email.trim();
  return normalized.length <= MAXIMUM_EMAIL_LENGTH && EMAIL_PATTERN.test(normalized);
}

export function passwordStrength(password: string): PasswordStrengthResult {
  const characterGroups = [/[a-záéíóúñ]/i, /\d/, /[^\p{L}\p{N}\s]/u]
    .filter((pattern) => pattern.test(password)).length;
  if (password.length >= MINIMUM_PASSWORD_LENGTH && characterGroups >= 3) {
    return { level: 3, label: 'Fuerte' };
  }
  if (password.length >= MINIMUM_PASSWORD_LENGTH || (password.length >= 8 && characterGroups >= 2)) {
    return { level: 2, label: 'Media' };
  }
  return { level: 1, label: 'Básica' };
}

export function validateLoginInput(email: string, password: string): AuthValidationErrors {
  const normalizedEmail = email.trim();
  return {
    ...(!isValidEmail(normalizedEmail)
      ? { email: normalizedEmail ? 'Escribe un correo electrónico válido.' : 'El correo es obligatorio.' }
      : {}),
    ...(!password
      ? { password: 'La contraseña es obligatoria.' }
      : password.length > MAXIMUM_PASSWORD_LENGTH
        ? { password: `La contraseña no puede superar ${MAXIMUM_PASSWORD_LENGTH} caracteres.` }
        : {}),
  };
}

export function validateRegistrationInput(input: {
  readonly name: string;
  readonly email: string;
  readonly password: string;
  readonly role: 'patient' | 'psychologist';
  readonly licenseNumber: string;
}): AuthValidationErrors {
  const loginErrors = validateLoginInput(input.email, input.password);
  const normalizedName = input.name.trim();
  const normalizedLicense = input.licenseNumber.trim();

  return {
    ...(normalizedName.length < MINIMUM_NAME_LENGTH || normalizedName.length > MAXIMUM_NAME_LENGTH
      ? { name: `El nombre debe tener entre ${MINIMUM_NAME_LENGTH} y ${MAXIMUM_NAME_LENGTH} caracteres.` }
      : {}),
    ...loginErrors,
    ...(input.password && input.password.length < MINIMUM_PASSWORD_LENGTH
      ? { password: `Usa al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.` }
      : {}),
    ...(input.role === 'psychologist'
      && (normalizedLicense.length < MINIMUM_LICENSE_NUMBER_LENGTH
        || normalizedLicense.length > MAXIMUM_LICENSE_NUMBER_LENGTH)
      ? { licenseNumber: `La colegiatura debe tener entre ${MINIMUM_LICENSE_NUMBER_LENGTH} y ${MAXIMUM_LICENSE_NUMBER_LENGTH} caracteres.` }
      : {}),
  };
}

export function validatePasswordResetRequest(email: string): AuthValidationErrors {
  const emailError = validateLoginInput(email, 'password-present').email;
  return emailError ? { email: emailError } : {};
}

export function validateNewPassword(
  password: string,
  passwordConfirmation: string
): AuthValidationErrors {
  return {
    ...(!password
      ? { password: 'La nueva contraseña es obligatoria.' }
      : password.length < MINIMUM_PASSWORD_LENGTH
        ? { password: `Usa al menos ${MINIMUM_PASSWORD_LENGTH} caracteres.` }
        : password.length > MAXIMUM_PASSWORD_LENGTH
          ? { password: `La contraseña no puede superar ${MAXIMUM_PASSWORD_LENGTH} caracteres.` }
        : {}),
    ...(passwordConfirmation !== password
      ? { passwordConfirmation: 'Las contraseñas deben coincidir.' }
      : {}),
  };
}

export function hasAuthValidationErrors(errors: AuthValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
