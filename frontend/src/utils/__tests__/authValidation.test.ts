import {
  hasAuthValidationErrors,
  passwordStrength,
  validateLoginInput,
  validateRegistrationInput,
} from '../authValidation';

describe('authValidation', () => {
  it('rechaza un correo inválido antes de consultar el backend', () => {
    const errors = validateLoginInput('usuario-sin-dominio', 'secreto');
    expect(errors.email).toBe('Escribe un correo electrónico válido.');
    expect(hasAuthValidationErrors(errors)).toBe(true);
  });

  it('clasifica fortaleza sin imponer requisitos distintos al backend', () => {
    expect(passwordStrength('corta')).toEqual({ level: 1, label: 'Básica' });
    expect(passwordStrength('frase-segura')).toEqual({ level: 2, label: 'Media' });
    expect(passwordStrength('Frase-segura-2026!')).toEqual({ level: 3, label: 'Fuerte' });
  });

  it('exige una contraseña robusta al registrar una cuenta', () => {
    const errors = validateRegistrationInput({
      name: 'María López',
      email: 'maria@example.com',
      password: 'corta',
      role: 'patient',
      licenseNumber: '',
    });
    expect(errors.password).toBe('Usa al menos 12 caracteres.');
  });

  it('solo exige colegiatura a una cuenta profesional', () => {
    const patientErrors = validateRegistrationInput({
      name: 'María López',
      email: 'maria@example.com',
      password: 'frase-segura-123',
      role: 'patient',
      licenseNumber: '',
    });
    const psychologistErrors = validateRegistrationInput({
      name: 'Diana Castillo',
      email: 'diana@example.com',
      password: 'frase-segura-123',
      role: 'psychologist',
      licenseNumber: '',
    });
    expect(patientErrors).toEqual({});
    expect(psychologistErrors.licenseNumber).toBeDefined();
  });
});
