import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../domain/appError';
import { Logger } from '../../infrastructure/logging/logger';
import { getRequestId } from './requestContext';

function problemType(code: string): string {
  return `https://ruta-emocional.example/problems/${code.toLowerCase().replaceAll('_', '-')}`;
}

export function notFoundHandler(request: Request, response: Response): void {
  response.status(404).type('application/problem+json').json({
    type: problemType('ROUTE_NOT_FOUND'),
    title: 'Ruta no encontrada',
    status: 404,
    detail: 'La operación solicitada no existe.',
    instance: request.originalUrl.split('?')[0],
    code: 'ROUTE_NOT_FOUND',
    requestId: getRequestId(response),
  });
}

export function createErrorHandler(logger: Logger) {
  return (error: unknown, request: Request, response: Response, _next: NextFunction): void => {
    const requestId = getRequestId(response);
    const errorStatus = (error as { status?: unknown } | null)?.status;
    const isMalformedJson = error instanceof SyntaxError && errorStatus === 400;
    const appError = error instanceof AppError
      ? error
      : isMalformedJson
        ? AppError.badRequest('MALFORMED_JSON', 'El cuerpo JSON no es válido.')
        : new AppError(500, 'INTERNAL_ERROR', 'Error interno', 'No pudimos completar la operación.');

    if (appError.status >= 500) {
      logger.error('http.request.failed', {
        requestId,
        method: request.method,
        routeTemplate: request.route?.path || 'unmatched',
        error,
      });
    } else {
      logger.warn('http.request.rejected', {
        requestId,
        method: request.method,
        routeTemplate: request.route?.path || 'unmatched',
        errorCode: appError.code,
        statusCode: appError.status,
      });
    }

    const publicDetail = appError.status >= 500 ? 'No pudimos completar la operación.' : appError.message;
    response.status(appError.status).type('application/problem+json').json({
      type: problemType(appError.code),
      title: appError.title,
      status: appError.status,
      detail: publicDetail,
      instance: request.originalUrl.split('?')[0],
      code: appError.code,
      requestId,
      ...(appError.errors ? { errors: appError.errors } : {}),
    });
  };
}
