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
import { ClinicalRecordService } from '../application/clinicalRecordService';
import {
  parseAmendNote,
  parseClinicalIdempotencyKey,
  parseClinicalUuid,
  parseCreateEncounter,
  parseCreateTreatmentPlan,
  parseEncounterPageQuery,
  parseGoalStatus,
  parsePatientPageQuery,
  parsePlanTransition,
  parseSignNote,
  parseUpdateDraft,
} from './clinicalRecordValidation';

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

export function createClinicalRecordRouter(
  identity: IdentityService,
  service: ClinicalRecordService,
  policy: AppConfig['clinical']
): Router {
  const router = Router();
  const authenticate = requireAuthentication(identity);
  const mutationLimiter = createRateLimiter({
    windowMs: 60_000,
    maximum: policy.mutationsPerMinute,
  });

  router.get('/clinical/policy', authenticate, (request: AuthenticatedRequest, response) => {
    response.json(envelope(service.getPolicy(getActor(request)), response));
  });

  router.get('/clinical/patients', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const page = await service.listPatients(
      getActor(request),
      parsePatientPageQuery(request.query as Record<string, unknown>, policy)
    );
    response.json({
      data: page.items,
      meta: { requestId: getRequestId(response), nextCursor: page.nextCursor },
    });
  }));

  router.get('/clinical/patients/:patientUserId/record', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const record = await service.getRecord(
      getActor(request),
      parseClinicalUuid(request.params.patientUserId, 'patientUserId'),
      parseEncounterPageQuery(request.query as Record<string, unknown>, policy),
      auditContext(request, response)
    );
    response.json(envelope(record, response));
  }));

  router.get('/clinical/notes/:noteId/versions', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.json(envelope(await service.listNoteVersions(
      getActor(request),
      parseClinicalUuid(request.params.noteId, 'noteId'),
      auditContext(request, response)
    ), response));
  }));

  router.post('/clinical/encounters', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const created = await service.createEncounter(
      getActor(request),
      parseCreateEncounter(request.body, policy),
      parseClinicalIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    );
    response.status(201).json(envelope(created, response));
  }));

  router.put('/clinical/notes/:noteId/draft', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.json(envelope(await service.updateDraft(
      getActor(request),
      parseClinicalUuid(request.params.noteId, 'noteId'),
      parseUpdateDraft(request.body, policy),
      parseClinicalIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    ), response));
  }));

  router.post('/clinical/notes/:noteId/sign', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.json(envelope(await service.signNote(
      getActor(request),
      parseClinicalUuid(request.params.noteId, 'noteId'),
      parseSignNote(request.body),
      parseClinicalIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    ), response));
  }));

  router.post('/clinical/notes/:noteId/amendments', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.status(201).json(envelope(await service.amendNote(
      getActor(request),
      parseClinicalUuid(request.params.noteId, 'noteId'),
      parseAmendNote(request.body, policy),
      parseClinicalIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    ), response));
  }));

  router.post('/clinical/treatment-plans', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.status(201).json(envelope(await service.createTreatmentPlan(
      getActor(request),
      parseCreateTreatmentPlan(request.body, policy),
      parseClinicalIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    ), response));
  }));

  router.post('/clinical/treatment-plans/:planId/transitions', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.json(envelope(await service.transitionTreatmentPlan(
      getActor(request),
      parseClinicalUuid(request.params.planId, 'planId'),
      parsePlanTransition(request.body),
      parseClinicalIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    ), response));
  }));

  router.patch('/clinical/treatment-goals/:goalId/status', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.json(envelope(await service.updateTreatmentGoal(
      getActor(request),
      parseClinicalUuid(request.params.goalId, 'goalId'),
      parseGoalStatus(request.body),
      parseClinicalIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    ), response));
  }));

  return router;
}
