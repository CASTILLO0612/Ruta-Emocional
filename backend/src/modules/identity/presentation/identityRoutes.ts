import { createHash } from 'crypto';
import express, { Router } from 'express';
import { AppConfig } from '../../../config/env';
import { IdentityService } from '../application/identityService';
import { asyncHandler } from '../../../shared/presentation/http/asyncHandler';
import { createRateLimiter } from '../../../shared/presentation/http/rateLimiter';
import { getRequestId } from '../../../shared/presentation/http/requestContext';
import { AuthenticatedRequest, getActor, requireAuthentication } from './authMiddleware';
import {
  parseLogin,
  parseGoogleLogin,
  parsePasswordResetCompletion,
  parsePasswordResetRequest,
  parsePatientRegistration,
  parsePsychologistRegistration,
  parseRefresh,
  parseProfilePhotoUpload,
  parseUpdateOwnProfile,
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

export function createIdentityRouter(
  identity: IdentityService,
  passwordRecovery: { readonly requestsPerHour: number },
  media: AppConfig['media']
): Router {
  const router = Router();
  const registrationLimiter = createRateLimiter({ windowMs: 60 * 60_000, maximum: 5, key: rateLimitKey });
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60_000, maximum: 10, key: rateLimitKey });
  const refreshLimiter = createRateLimiter({ windowMs: 60_000, maximum: 30 });
  const passwordResetRequestLimiter = createRateLimiter({
    windowMs: 60 * 60_000,
    maximum: passwordRecovery.requestsPerHour,
    key: rateLimitKey,
  });
  const passwordResetCompletionLimiter = createRateLimiter({ windowMs: 15 * 60_000, maximum: 10 });
  const profileMutationLimiter = createRateLimiter({ windowMs: 60_000, maximum: 20 });
  const photoUploadLimiter = createRateLimiter({
    windowMs: 60_000,
    maximum: media.profilePhotoUploadsPerMinute,
    key: (request) => getActor(request as AuthenticatedRequest).user.id,
  });
  const profilePhotoBody = express.raw({
    limit: media.profilePhotoMaximumBytes,
    type: ['image/jpeg', 'image/png', 'image/webp'],
  });
  const auth = requireAuthentication(identity);

  router.get('/profile-photos/:photoId', asyncHandler(async (request, response) => {
    const photo = await identity.readProfilePhoto(request.params.photoId);
    if (!photo) {
      response.status(404).end();
      return;
    }
    if (request.header('if-none-match') === photo.etag) {
      response.status(304).end();
      return;
    }
    response
      .set('Content-Type', photo.contentType)
      .set('Cache-Control', 'public, max-age=31536000, immutable')
      .set('ETag', photo.etag)
      .send(Buffer.from(photo.bytes));
  }));

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

  router.post('/google', loginLimiter, asyncHandler(async (request, response) => {
    const body = parseGoogleLogin(request.body);
    const result = await identity.loginWithGoogle({
      ...body,
      ...requestMetadata(request, getRequestId(response), body.deviceName),
    });
    response.json({ data: result, meta: { requestId: getRequestId(response) } });
  }));

  router.post(
    '/password-reset/request',
    passwordResetRequestLimiter,
    asyncHandler(async (request, response) => {
      const body = parsePasswordResetRequest(request.body);
      const result = await identity.requestPasswordReset(
        body.email,
        requestMetadata(request, getRequestId(response))
      );
      response.status(202).json({ data: result, meta: { requestId: getRequestId(response) } });
    })
  );

  router.post(
    '/password-reset/complete',
    passwordResetCompletionLimiter,
    asyncHandler(async (request, response) => {
      const body = parsePasswordResetCompletion(request.body);
      await identity.completePasswordReset(
        body.token,
        body.password,
        requestMetadata(request, getRequestId(response))
      );
      response.status(204).end();
    })
  );

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

  router.patch('/me', auth, profileMutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const body = parseUpdateOwnProfile(request.body);
    const user = await identity.updateOwnProfile(getActor(request), {
      ...body,
      requestId: getRequestId(response),
      ipAddress: request.ip,
    });
    response.json({ data: user, meta: { requestId: getRequestId(response) } });
  }));

  router.put(
    '/me/photo',
    auth,
    photoUploadLimiter,
    profilePhotoBody,
    asyncHandler(async (request: AuthenticatedRequest, response) => {
      const photo = parseProfilePhotoUpload({
        body: request.body,
        contentType: request.header('content-type'),
        maximumBytes: media.profilePhotoMaximumBytes,
      });
      const user = await identity.replaceOwnProfilePhoto(getActor(request), photo, {
        requestId: getRequestId(response),
        ipAddress: request.ip,
      });
      response.json({ data: user, meta: { requestId: getRequestId(response) } });
    })
  );

  router.delete('/me/photo', auth, profileMutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const user = await identity.removeOwnProfilePhoto(getActor(request), {
      requestId: getRequestId(response),
      ipAddress: request.ip,
    });
    response.json({ data: user, meta: { requestId: getRequestId(response) } });
  }));

  return router;
}
