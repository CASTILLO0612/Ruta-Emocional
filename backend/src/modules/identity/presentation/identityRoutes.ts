import { createHash } from 'crypto';
import { Router } from 'express';
import { IdentityService } from '../application/identityService';
import { asyncHandler } from '../../../shared/presentation/http/asyncHandler';
import { createRateLimiter } from '../../../shared/presentation/http/rateLimiter';
import { getRequestId } from '../../../shared/presentation/http/requestContext';
import { AuthenticatedRequest, getActor, requireAuthentication } from './authMiddleware';
import {
  parseLogin,
  parsePatientRegistration,
  parsePsychologistRegistration,
  parseRefresh,
} from './identityValidation';

function requestMetadata(request: AuthenticatedRequest, requestId: string, deviceName?: string) {
  return {
    requestId,
    ipAddress: request.ip,
    userAgent: request.header('user-agent')?.slice(0, 1000),
    deviceName,
  };
}

function rateLimitKey(request: AuthenticatedRequest): string {
  const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
  return createHash('sha256').update(`${request.ip}|${email}`, 'utf8').digest('hex');
}

export function createIdentityRouter(identity: IdentityService): Router {
  const router = Router();
  const registrationLimiter = createRateLimiter({ windowMs: 60 * 60_000, maximum: 5, key: rateLimitKey });
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60_000, maximum: 10, key: rateLimitKey });
  const refreshLimiter = createRateLimiter({ windowMs: 60_000, maximum: 30 });
  const auth = requireAuthentication(identity);

  router.post('/register/patient', registrationLimiter, asyncHandler(async (request, response) => {
    const body = parsePatientRegistration(request.body);
    const result = await identity.registerPatient({
      ...body,
      ...requestMetadata(request, getRequestId(response)),
    });
    response.status(201).json({ data: result, meta: { requestId: getRequestId(response) } });
  }));

  router.post('/register/psychologist', registrationLimiter, asyncHandler(async (request, response) => {
    const body = parsePsychologistRegistration(request.body);
    const result = await identity.registerPsychologist({
      ...body,
      ...requestMetadata(request, getRequestId(response)),
    });
    response.status(201).json({ data: result, meta: { requestId: getRequestId(response) } });
  }));

  router.post('/login', loginLimiter, asyncHandler(async (request, response) => {
    const body = parseLogin(request.body);
    const result = await identity.login({
      ...body,
      ...requestMetadata(request, getRequestId(response), body.deviceName),
    });
    response.json({ data: result, meta: { requestId: getRequestId(response) } });
  }));

  router.post('/refresh', refreshLimiter, asyncHandler(async (request, response) => {
    const refreshToken = parseRefresh(request.body);
    const tokens = await identity.refresh(refreshToken, getRequestId(response));
    response.json({ data: tokens, meta: { requestId: getRequestId(response) } });
  }));

  router.post('/logout', auth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    await identity.logout(getActor(request).sessionId, getRequestId(response));
    response.status(204).end();
  }));

  router.post('/logout-all', auth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    await identity.logoutAll(getActor(request).user.id, getRequestId(response));
    response.status(204).end();
  }));

  router.get('/me', auth, asyncHandler(async (request: AuthenticatedRequest, response) => {
    response.json({ data: getActor(request).user, meta: { requestId: getRequestId(response) } });
  }));

  return router;
}
