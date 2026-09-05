import { ApiError } from '../../services/apiClient';
import { presentUserError } from '../userFacingError';

describe('presentUserError', () => {
  it('oculta detalles internos de servidor y conserva un mensaje contextual', () => {
    const error = new ApiError({
      status: 500,
      code: 'INTERNAL_ERROR',
      message: 'Prisma failed at http://localhost:5000 with P2002',
    });

    expect(presentUserError(error, 'No pudimos confirmar la propuesta.')).toBe(
      'No pudimos confirmar la propuesta.'
    );
  });

  it('presenta validaciones comprensibles sin exponer códigos técnicos', () => {
    const error = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Revisa los datos enviados.',
      fieldErrors: [
        { code: 'REQUIRED', message: 'Selecciona una modalidad.' },
        { code: 'REQUIRED', message: 'Selecciona una modalidad.' },
      ],
    });

    expect(presentUserError(error)).toBe('Selecciona una modalidad.');
  });

  it('usa una orientación estable cuando no hay conexión', () => {
    const error = new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Failed to fetch http://localhost:5000',
    });

    expect(presentUserError(error)).toBe(
      'No pudimos conectar con Ruta Emocional. Revisa tu conexión e inténtalo nuevamente.'
    );
  });

  it('distingue credenciales incorrectas de una sesión expirada', () => {
    const error = new ApiError({
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'La sesión no es válida o expiró.',
    });

    expect(presentUserError(error)).toBe(
      'El correo o la contraseña no coinciden. Revísalos e intenta nuevamente.'
    );
  });

  it('ofrece una orientación no técnica al limitar intentos', () => {
    const error = new ApiError({
      status: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Espera antes de volver a intentarlo.',
    });

    expect(presentUserError(error)).toBe(
      'Has realizado varios intentos. Espera un momento antes de volver a intentar.'
    );
  });
});
