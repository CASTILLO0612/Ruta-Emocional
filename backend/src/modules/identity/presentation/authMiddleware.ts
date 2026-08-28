import { NextFunction, Request, RequestHandler, Response } from 'express';
import { AppError } from '../../../shared/domain/appError';
import { IdentityService, AuthenticatedActor } from '../application/identityService';

export interface AuthenticatedRequest extends Request {
  actor?: AuthenticatedActor;
}

export function requireAuthentication(identity: IdentityService): RequestHandler {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction): void => {
    const authorization = request.header('authorization');
    const match = authorization?.match(/^Bearer ([^\s]+)$/);
    if (!match) {
      next(AppError.unauthorized('MISSING_ACCESS_TOKEN'));
      return;
    }

    void identity.authenticateAccessToken(match[1])
      .then((actor) => {
        request.actor = actor;
        next();
      })
      .catch(next);
  };
}

export function getActor(request: AuthenticatedRequest): AuthenticatedActor {
  if (!request.actor) throw AppError.unauthorized();
  return request.actor;
}

export function requireCapability(capability: string): RequestHandler {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction): void => {
    try {
      const actor = getActor(request);
      if (!actor.user.capabilities.includes(capability)) {
        throw AppError.forbidden('CAPABILITY_REQUIRED');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
