import { NextFunction, Request, Response } from 'express';
import { RuntimeEnvironment } from '../../../config/env';

export function securityHeaders(environment: RuntimeEnvironment) {
  return (_request: Request, response: Response, next: NextFunction): void => {
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader('Cache-Control', 'no-store');
    if (environment === 'production') {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}
