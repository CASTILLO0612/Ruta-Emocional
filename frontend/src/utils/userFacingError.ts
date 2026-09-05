import { ApiError } from '../services/apiClient';

const DEFAULT_MESSAGE = 'No pudimos completar la acción. Inténtalo nuevamente.';
const TECHNICAL_CONTENT = /localhost|127\.0\.0\.1|https?:\/\/|prisma|postgres|\bsql\b|stack trace|typeerror|referenceerror|syntaxerror|\berr_[a-z_]+|\bhttp_?\d{3}\b|\bundefined\b|\bnull\b|\sat\s+[\w$.]+\s*\(/i;

function safeMessage(message: string | undefined): string | null {
  const normalized = message?.trim();
  if (!normalized || TECHNICAL_CONTENT.test(normalized)) return null;
  return normalized;
}

export function presentUserError(error: unknown, fallback = DEFAULT_MESSAGE): string {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_CREDENTIALS') {
      return 'El correo o la contraseña no coinciden. Revísalos e intenta nuevamente.';
    }
    if (error.code === 'ACCOUNT_UNAVAILABLE') {
      return 'Esta cuenta no está disponible. Solicita ayuda si consideras que se trata de un error.';
    }
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Has realizado varios intentos. Espera un momento antes de volver a intentar.';
    }
    if (error.code === 'NETWORK_ERROR' || error.status === 0) {
      return 'No pudimos conectar con Ruta Emocional. Revisa tu conexión e inténtalo nuevamente.';
    }
    if (error.status === 401) {
      return 'Tu sesión terminó por seguridad. Inicia sesión nuevamente para continuar.';
    }
    if (error.status === 403) {
      return 'Tu cuenta no tiene permiso para realizar esta acción.';
    }
    if (error.status >= 500) return fallback;

    const fieldMessages = error.fieldErrors
      .map(({ message }) => safeMessage(message))
      .filter((message): message is string => message !== null);
    if (fieldMessages.length > 0) return [...new Set(fieldMessages)].join('\n');

    return safeMessage(error.message) ?? fallback;
  }

  if (error instanceof Error) return safeMessage(error.message) ?? fallback;
  return fallback;
}
