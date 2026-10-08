import { Router } from 'express';
import type { AppConfig } from '../../../config/env';
import { asyncHandler } from '../../../shared/presentation/http/asyncHandler';
import { AppError } from '../../../shared/domain/appError';
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
import { streamMentaTurn, writeMentaStreamEvent } from './mentaStream';

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

function streamFailureMessage(error: unknown): string {
  if (error instanceof AppError && error.status < 500) return error.message;
  return 'No pudimos completar la respuesta de MENTA. Inténtalo nuevamente.';
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
    '/menta/conversations/:conversationId/restart',
    authenticate,
    messageLimiter,
    asyncHandler(async (request: AuthenticatedRequest, response) => {
      const conversationId = parseMentaUuid(request.params.conversationId, 'conversationId');
      const conversation = await service.restartConversation(
        getActor(request),
        conversationId,
        auditContext(request, response)
      );
      response.status(201).json(envelope(conversation, response));
    })
  );

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

  router.post(
    '/menta/conversations/:conversationId/turns/stream',
    authenticate,
    messageLimiter,
    (request: AuthenticatedRequest, response, next) => {
      let conversationId: string;
      let command: ReturnType<typeof parseMentaMessage>;
      try {
        conversationId = parseMentaUuid(request.params.conversationId, 'conversationId');
        command = parseMentaMessage(request.body);
      } catch (error) {
        next(error);
        return;
      }

      response.status(200).set({
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Content-Type': 'text/event-stream; charset=utf-8',
        'X-Accel-Buffering': 'no',
      });
      response.flushHeaders();
      writeMentaStreamEvent(response, 'status', { message: 'MENTA está preparando una respuesta.' });
      const controller = new AbortController();
      let streamedText = '';
      response.once('close', () => {
        if (!response.writableEnded) controller.abort();
      });

      void service.sendMessage(
        getActor(request),
        conversationId,
        command.clientMessageId,
        command.message,
        auditContext(request, response),
        {
          signal: controller.signal,
          onTextDelta: (delta) => {
            streamedText += delta;
            writeMentaStreamEvent(response, 'delta', { delta });
          },
        }
      ).then(async (turn) => {
        if (!streamedText) {
          await streamMentaTurn(response, turn, policy.streamingChunkIntervalMs);
        } else {
          if (streamedText.trim() !== turn.assistantMessage) {
            writeMentaStreamEvent(response, 'replace', { text: turn.assistantMessage });
          }
          writeMentaStreamEvent(response, 'completed', { turn });
        }
        if (!response.writableEnded) response.end();
      }).catch((error: unknown) => {
        writeMentaStreamEvent(response, 'error', { message: streamFailureMessage(error) });
        if (!response.writableEnded) response.end();
      });
    }
  );

  return router;
}
