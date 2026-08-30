import { Router } from 'express';
import { AppConfig } from '../../../config/env';
import { asyncHandler } from '../../../shared/presentation/http/asyncHandler';
import { createRateLimiter } from '../../../shared/presentation/http/rateLimiter';
import { getRequestId } from '../../../shared/presentation/http/requestContext';
import { IdentityService } from '../../identity/application/identityService';
import {
  AuthenticatedRequest,
  getActor,
  requireAuthentication,
} from '../../identity/presentation/authMiddleware';
import { TriageService } from '../application/triageService';
import {
  assertEmptyTriageBody,
  parseCreateTriageAssessment,
  parseTriageIdempotencyKey,
  parseTriageUuid,
} from './triageValidation';

function envelope<T>(data: T, response: Parameters<typeof getRequestId>[0]) {
  return { data, meta: { requestId: getRequestId(response) } };
}

function auditContext(request: AuthenticatedRequest, response: Parameters<typeof getRequestId>[0]) {
  return {
    actorUserId: getActor(request).user.id,
    requestId: getRequestId(response),
    ipAddress: request.ip,
  };
}

export function createTriageRouter(
  identity: IdentityService,
  service: TriageService,
  policy: AppConfig['triage']
): Router {
  const router = Router();
  const authenticate = requireAuthentication(identity);
  const assessmentLimiter = createRateLimiter({
    windowMs: 60_000,
    maximum: policy.assessmentsPerMinute,
  });

  router.get('/triage/policy', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.json(envelope(await service.getPolicy(getActor(request)), response));
  }));

  router.post('/triage/assessments', authenticate, assessmentLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const assessment = await service.createAssessment(
      getActor(request),
      parseCreateTriageAssessment(request.body),
      parseTriageIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    );
    response.status(201).json(envelope(assessment, response));
  }));

  router.get('/triage/assessments/:assessmentId', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const assessmentId = parseTriageUuid(request.params.assessmentId, 'assessmentId');
    response.json(envelope(await service.getAssessment(
      getActor(request),
      assessmentId,
      auditContext(request, response)
    ), response));
  }));

  router.post(
    '/triage/assessments/:assessmentId/review',
    authenticate,
    assessmentLimiter,
    asyncHandler(async (request: AuthenticatedRequest, response) => {
      assertEmptyTriageBody(request.body);
      const assessmentId = parseTriageUuid(request.params.assessmentId, 'assessmentId');
      response.json(envelope(await service.reviewAssessment(
        getActor(request),
        assessmentId,
        auditContext(request, response)
      ), response));
    })
  );

  return router;
}

