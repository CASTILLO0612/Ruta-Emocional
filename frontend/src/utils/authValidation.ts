export const MINIMUM_PASSWORD_LENGTH = 12;
export const MINIMUM_LICENSE_NUMBER_LENGTH = 4;
export const MAXIMUM_LICENSE_NUMBER_LENGTH = 80;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthValidationErrors {
  readonly name?: string;
  readonly email?: string;
  readonly password?: string;
  readonly licenseNumber?: string;
}

export function validateLoginInput(email: string, password: string): AuthValidationErrors {
  const normalizedEmail = email.trim();
  return {
    ...(!EMAIL_PATTERN.test(normalizedEmail)
      ? { email: normalizedEmail ? 'Escribe un correo electrónico válido.' : 'El correo es obligatorio.' }
      : {}),
    ...(!password ? { password: 'La contraseña es obligatoria.' } : {}),
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
    ...(!normalizedName ? { name: 'El nombre completo es obligatorio.' } : {}),
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

export function hasAuthValidationErrors(errors: AuthValidationErrors): boolean {
  return Object.keys(errors).length > 0;
}
