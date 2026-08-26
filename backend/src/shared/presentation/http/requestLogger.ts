import { NextFunction, Request, Response } from 'express';
import { Logger } from '../../infrastructure/logging/logger';
import { getRequestId } from './requestContext';

export function requestLogger(logger: Logger) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const routePath = request.route?.path as string | undefined;
      logger.info('http.request.completed', {
        requestId: getRequestId(response),
        method: request.method,
        routeTemplate: routePath ? `${request.baseUrl}${routePath}` : 'unmatched',
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
    });

    next();
  };
}
