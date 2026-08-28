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
import { AppointmentService } from '../application/appointmentService';
import {
  parseAppointmentIdempotencyKey,
  parseAppointmentPageQuery,
  parseAppointmentUuid,
  parseCreateAppointment,
  parseReschedule,
  parseSlotQuery,
  parseTransition,
} from './appointmentValidation';

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

export function createAppointmentRouter(
  identity: IdentityService,
  service: AppointmentService,
  policy: AppConfig['appointments']
): Router {
  const router = Router();
  const authenticate = requireAuthentication(identity);
  const mutationLimiter = createRateLimiter({ windowMs: 60_000, maximum: policy.mutationsPerMinute });

  router.get('/appointments/policy', authenticate, (_request, response) => {
    response.json(envelope(service.getPolicy(), response));
  });

  router.get('/appointment-relationships', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    response.json(envelope(await service.listRelationships(getActor(request)), response));
  }));

  router.get('/appointment-slots', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const query = parseSlotQuery(request.query as Record<string, unknown>);
    response.json(envelope(await service.listAvailableSlots(
      getActor(request),
      query.careRelationshipId,
      query.modality,
      query.from,
      query.until
    ), response));
  }));

  router.get('/appointments', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const page = await service.list(
      getActor(request),
      parseAppointmentPageQuery(request.query as Record<string, unknown>, policy)
    );
    response.json({
      data: page.items,
      meta: { requestId: getRequestId(response), nextCursor: page.nextCursor },
    });
  }));

  router.post('/appointments', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const created = await service.create(
      getActor(request),
      parseCreateAppointment(request.body),
      parseAppointmentIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    );
    response.status(201).json(envelope(created, response));
  }));

  router.post('/appointments/:appointmentId/transitions', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const appointmentId = parseAppointmentUuid(request.params.appointmentId, 'appointmentId');
    const command = parseTransition(request.body, policy);
    response.json(envelope(await service.transition(
      getActor(request),
      appointmentId,
      command.transition,
      command.reason,
      parseAppointmentIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    ), response));
  }));

  router.post('/appointments/:appointmentId/reschedule', authenticate, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const appointmentId = parseAppointmentUuid(request.params.appointmentId, 'appointmentId');
    const command = parseReschedule(request.body);
    response.json(envelope(await service.reschedule(
      getActor(request),
      appointmentId,
      command.startsAt,
      parseAppointmentIdempotencyKey(request.header('idempotency-key')),
      auditContext(request, response)
    ), response));
  }));

  return router;
}
