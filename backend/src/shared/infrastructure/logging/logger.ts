import { RuntimeEnvironment } from '../../../config/env';

export interface LogContext {
  readonly [key: string]: unknown;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

const REDACTED_KEYS = new Set([
  'authorization', 'cookie', 'password', 'passwordhash', 'accesstoken',
  'refreshtoken', 'token', 'secret', 'content', 'text', 'description',
  'diagnosis', 'note', 'coordinates', 'location',
]);

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[MAX_DEPTH]';
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : sanitize(item, depth + 1),
      ])
    );
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

export function createLogger(environment: RuntimeEnvironment): Logger {
  function write(level: string, message: string, context?: LogContext): void {
    if (level === 'debug' && environment === 'production') return;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'ruta-emocional-api',
      environment,
      message,
      ...(context ? (sanitize(context) as object) : {}),
    };
    const output = `${JSON.stringify(entry)}\n`;
    if (level === 'error') process.stderr.write(output);
    else process.stdout.write(output);
  }

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
  };
}
