import { CorsOptions } from 'cors';

export function createCorsOptions(allowedOrigins: readonly string[]): CorsOptions {
  const allowlist = new Set(allowedOrigins);
  return {
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'Retry-After'],
    maxAge: 600,
    origin(origin, callback) {
      if (!origin || allowlist.has(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  };
}
