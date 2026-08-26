export interface FieldError {
  readonly field?: string;
  readonly code: string;
  readonly message: string;
}

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly title: string,
    message: string,
    public readonly errors?: readonly FieldError[]
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string): AppError {
    return new AppError(400, code, 'La solicitud no es válida', message);
  }

  static unauthorized(code = 'UNAUTHORIZED'): AppError {
    return new AppError(401, code, 'Autenticación requerida', 'La sesión no es válida o expiró.');
  }

  static forbidden(code = 'FORBIDDEN'): AppError {
    return new AppError(403, code, 'Acceso denegado', 'No tienes permiso para realizar esta operación.');
  }

  static conflict(code: string, message: string): AppError {
    return new AppError(409, code, 'La operación entra en conflicto con el estado actual', message);
  }

  static validation(errors: readonly FieldError[]): AppError {
    return new AppError(
      422,
      'VALIDATION_ERROR',
      'La solicitud no es válida',
      'Revisa los campos indicados.',
      errors
    );
  }
}
