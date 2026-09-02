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
} from '../../identity/presentation/authMiddleware';
import type { MentaService } from '../application/mentaService';
import {
  parseMentaMessage,
  parseMentaScope,
  parseMentaUuid,
  parseOpenMentaConversation,
} from './mentaValidation';

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

export function createMentaRouter(
  identity: IdentityService,
  service: MentaService,
  policy: AppConfig['menta']
): Router {
  const router = Router();
  const authenticate = requireAuthentication(identity);
  const messageLimiter = createRateLimiter({
    windowMs: 60_000,
    maximum: policy.requestsPerMinute,
    key: (request) => (request as AuthenticatedRequest).actor?.user.id
      ?? request.ip
      ?? 'unknown',
  });

  router.get('/menta/bootstrap', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const scope = parseMentaScope(request.query.scope);
    response.json(envelope(await service.bootstrap(getActor(request), scope), response));
  }));

  router.post('/menta/conversations', authenticate, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const command = parseOpenMentaConversation(request.body);
    const conversation = await service.openConversation(
      getActor(request),
      command.scope,
      command.consentGranted,
      auditContext(request, response)
    );
    response.status(201).json(envelope(conversation, response));
  }));

  router.post(
    '/menta/conversations/:conversationId/turns',
    authenticate,
    messageLimiter,
    asyncHandler(async (request: AuthenticatedRequest, response) => {
      const conversationId = parseMentaUuid(request.params.conversationId, 'conversationId');
      const command = parseMentaMessage(request.body);
      const turn = await service.sendMessage(
        getActor(request),
        conversationId,
        command.clientMessageId,
        command.message,
        auditContext(request, response)
      );
      response.status(201).json(envelope(turn, response));
    })
  );

  return router;
}
