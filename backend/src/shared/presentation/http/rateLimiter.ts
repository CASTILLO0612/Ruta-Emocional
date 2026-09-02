import { NextFunction, Request, RequestHandler, Response } from 'express';

interface Entry {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  readonly windowMs: number;
  readonly maximum: number;
  readonly key?: (request: Request) => string;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const entries = new Map<string, Entry>();
  let requestsSinceSweep = 0;
  const maximumEntries = 10_000;

  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    const key = options.key?.(request) || request.ip || request.socket.remoteAddress || 'unknown';
    const existing = entries.get(key);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : existing;

    entry.count += 1;
    entries.set(key, entry);

    if (entries.size > maximumEntries) {
      const oldestKey = entries.keys().next().value as string | undefined;
      if (oldestKey) entries.delete(oldestKey);
    }

    requestsSinceSweep += 1;
    if (requestsSinceSweep >= 500) {
      requestsSinceSweep = 0;
      for (const [entryKey, value] of entries) {
        if (value.resetAt <= now) entries.delete(entryKey);
      }
    }

    response.setHeader('RateLimit-Limit', options.maximum);
    response.setHeader('RateLimit-Remaining', Math.max(options.maximum - entry.count, 0));
    response.setHeader('RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > options.maximum) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      response.setHeader('Retry-After', retryAfterSeconds);
      response.status(429).type('application/problem+json').json({
        type: 'https://ruta-emocional.example/problems/rate-limit-exceeded',
        title: 'Demasiadas solicitudes',
        status: 429,
        detail: 'Espera antes de volver a intentarlo.',
        instance: request.originalUrl.split('?')[0],
        code: 'RATE_LIMIT_EXCEEDED',
        requestId: response.locals.requestId,
      });
      return;
    }

    next();
  };
}
