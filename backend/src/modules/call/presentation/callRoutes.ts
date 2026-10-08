import { Router } from 'express';
import type { AppConfig } from '../../../config/env';
import { asyncHandler } from '../../../shared/presentation/http/asyncHandler';
import { createRateLimiter } from '../../../shared/presentation/http/rateLimiter';
import { getRequestId } from '../../../shared/presentation/http/requestContext';
import type { IdentityService } from '../../identity/application/identityService';
import {
  AuthenticatedRequest,
  getActor,
  requireAuthentication,
  requireCapability,
} from '../../identity/presentation/authMiddleware';
import type { CallService } from '../application/callService';
import { parseCallMediaType, parseCallUuid } from './callValidation';

export function createCallRouter(
  identity: IdentityService,
  service: CallService,
  config: AppConfig['calls']
): Router {
  const router = Router();
  const authenticate = requireAuthentication(identity);
  const canCall = requireCapability('conversation:read:self');
  const mutationLimiter = createRateLimiter({ windowMs: 60_000, maximum: config.mutationsPerMinute });

  router.post('/conversations/:conversationId/calls', authenticate, canCall, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const actor = getActor(request);
    const result = await service.start(
      actor,
      parseCallUuid(request.params.conversationId, 'conversationId'),
      parseCallMediaType(request.body),
      { actorUserId: actor.user.id, requestId: getRequestId(response), ipAddress: request.ip }
    );
    response.status(201).json({ data: result, meta: { requestId: getRequestId(response) } });
  }));

  router.get('/calls/:callId', authenticate, canCall, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const call = await service.get(getActor(request), parseCallUuid(request.params.callId, 'callId'));
    response.json({ data: call, meta: { requestId: getRequestId(response) } });
  }));

  router.post('/calls/:callId/join', authenticate, canCall, mutationLimiter, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const actor = getActor(request);
    const result = await service.join(
      actor,
      parseCallUuid(request.params.callId, 'callId'),
      { actorUserId: actor.user.id, requestId: getRequestId(response), ipAddress: request.ip }
    );
    response.json({ data: result, meta: { requestId: getRequestId(response) } });
  }));

  for (const outcome of ['DECLINED', 'ENDED'] as const) {
    router.post(`/calls/:callId/${outcome === 'DECLINED' ? 'decline' : 'end'}`, authenticate, canCall, mutationLimiter, asyncHandler(async (
      request: AuthenticatedRequest,
      response
    ) => {
      const actor = getActor(request);
      const call = await service.finish(
        actor,
        parseCallUuid(request.params.callId, 'callId'),
        outcome,
        { actorUserId: actor.user.id, requestId: getRequestId(response), ipAddress: request.ip }
      );
      response.json({ data: call, meta: { requestId: getRequestId(response) } });
    }));
  }

  return router;
}
