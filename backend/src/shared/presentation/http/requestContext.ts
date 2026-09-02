import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requestContext(request: Request, response: Response, next: NextFunction): void {
  const candidate = request.header('x-request-id')?.trim();
  const requestId = candidate && UUID_PATTERN.test(candidate) ? candidate : randomUUID();

  response.locals.requestId = requestId;
  response.setHeader('X-Request-Id', requestId);
  next();
}

export function getRequestId(response: Response): string {
  return typeof response.locals.requestId === 'string' ? response.locals.requestId : randomUUID();
}
