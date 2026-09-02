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
  requireCapability,
} from '../../identity/presentation/authMiddleware';
import { MessagingService } from '../application/messagingService';
import {
  parseMessagePageQuery,
  parsePageQuery,
  parseSendMessage,
  parseUuid,
} from './messagingValidation';

export function createMessagingRouter(
  identity: IdentityService,
  service: MessagingService,
  config: AppConfig['messaging']
): Router {
  const router = Router();
  const authenticate = requireAuthentication(identity);
  const canRead = requireCapability('conversation:read:self');
  const canSend = requireCapability('conversation:send:self');
  const mutationLimiter = createRateLimiter({ windowMs: 60_000, maximum: config.messagesPerMinute });

  router.get('/conversations/policy', authenticate, canRead, (_request, response) => {
    response.json({ data: service.getPolicy(), meta: { requestId: getRequestId(response) } });
  });

  router.get('/conversations', authenticate, canRead, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const page = await service.listConversations(
      getActor(request),
      parsePageQuery(request.query as Record<string, unknown>, config)
    );
    response.json({
      data: page.items,
      page: { nextCursor: page.nextCursor, hasMore: Boolean(page.nextCursor) },
      meta: { requestId: getRequestId(response) },
    });
  }));

  router.get('/conversations/:conversationId', authenticate, canRead, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const conversationId = parseUuid(request.params.conversationId, 'conversationId');
    const data = await service.findConversation(getActor(request), conversationId);
    response.json({ data, meta: { requestId: getRequestId(response) } });
  }));

  router.get('/conversations/:conversationId/messages', authenticate, canRead, asyncHandler(async (
    request: AuthenticatedRequest,
    response
  ) => {
    const conversationId = parseUuid(request.params.conversationId, 'conversationId');
    const page = await service.listMessages(
      getActor(request),
      conversationId,
      parseMessagePageQuery(request.query as Record<string, unknown>, config)
    );
    response.json({
      data: page.items,
      page: { nextCursor: page.nextCursor, hasMore: Boolean(page.nextCursor) },
      meta: { requestId: getRequestId(response) },
    });
  }));

  router.post(
    '/conversations/:conversationId/messages',
    authenticate,
    canSend,
    mutationLimiter,
    asyncHandler(async (request: AuthenticatedRequest, response) => {
      const conversationId = parseUuid(request.params.conversationId, 'conversationId');
      const result = await service.sendMessage(
        getActor(request),
        conversationId,
        parseSendMessage(request.body, config),
        {
          actorUserId: getActor(request).user.id,
          requestId: getRequestId(response),
          ipAddress: request.ip,
        }
      );
      response.status(result.replayed ? 200 : 201).json({
        data: result,
        meta: { requestId: getRequestId(response) },
      });
    })
  );

  return router;
}
