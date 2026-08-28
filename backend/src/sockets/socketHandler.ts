import { Server, Socket } from 'socket.io';
import type { AppConfig } from '../config/env';
import type { AuthenticatedActor, IdentityService } from '../modules/identity/application/identityService';
import type { MessagingService } from '../modules/messaging/application/messagingService';
import type { MessageView } from '../modules/messaging/domain/messagingTypes';
import type { Logger } from '../shared/infrastructure/logging/logger';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SocketData {
  token: string;
  actor: AuthenticatedActor;
  conversationIds: Set<string>;
  revalidationTimer?: NodeJS.Timeout;
}

interface SocketAck {
  readonly ok: boolean;
  readonly code?: string;
}

export interface RealtimePublisher {
  publishMessageCreated(message: MessageView): Promise<void>;
  publishPsychologistVerificationUpdated(event: {
    readonly userId: string;
    readonly status: 'VERIFIED' | 'REJECTED';
  }): Promise<void>;
  publishAppointmentUpdated(event: {
    readonly appointmentId: string;
    readonly status: string;
    readonly userIds: readonly string[];
  }): Promise<void>;
  publishAppointmentReminder(event: {
    readonly appointmentId: string;
    readonly startsAt: string;
    readonly minutesBefore: number;
    readonly userIds: readonly string[];
  }): Promise<void>;
}

function roomName(conversationId: string): string {
  return `conversation:${conversationId}`;
}

function userRoomName(userId: string): string {
  return `user:${userId}`;
}

function readHandshakeToken(socket: Socket): string | null {
  const handshakeToken = socket.handshake.auth?.token;
  const authorization = socket.handshake.headers.authorization;
  if (typeof handshakeToken === 'string' && handshakeToken.trim()) return handshakeToken.trim();
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }
  return null;
}

function readConversationId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const conversationId = (payload as Record<string, unknown>).conversationId;
  return typeof conversationId === 'string' && UUID_PATTERN.test(conversationId)
    ? conversationId.toLowerCase()
    : null;
}

export function setupSockets(
  io: Server,
  identity: IdentityService,
  messaging: MessagingService,
  logger: Logger,
  config: AppConfig['messaging']
): RealtimePublisher {
  io.use((socket, next) => {
    const token = readHandshakeToken(socket);
    if (!token) return next(new Error('UNAUTHORIZED'));
    void identity.authenticateAccessToken(token)
      .then((actor) => {
        socket.data = { token, actor, conversationIds: new Set<string>() } satisfies SocketData;
        next();
      })
      .catch(() => next(new Error('UNAUTHORIZED')));
  });

  io.on('connection', (socket) => {
    const data = socket.data as SocketData;
    void socket.join(userRoomName(data.actor.user.id));
    logger.info('realtime.socket.connected', { socketId: socket.id, userId: data.actor.user.id });

    const revalidate = async (): Promise<void> => {
      try {
        data.actor = await identity.authenticateAccessToken(data.token);
        for (const conversationId of [...data.conversationIds]) {
          try {
            await messaging.authorizeSubscription(data.actor, conversationId);
          } catch {
            data.conversationIds.delete(conversationId);
            await socket.leave(roomName(conversationId));
            logger.warn('realtime.subscription.revoked', {
              socketId: socket.id,
              userId: data.actor.user.id,
              conversationId,
            });
          }
        }
      } catch {
        socket.disconnect(true);
      }
    };
    data.revalidationTimer = setInterval(
      () => void revalidate(),
      config.socketAuthRevalidationSeconds * 1000
    );
    data.revalidationTimer.unref();

    socket.on('conversation.subscribe', async (
      payload: unknown,
      acknowledge?: (result: SocketAck) => void
    ) => {
      const conversationId = readConversationId(payload);
      if (!conversationId) {
        acknowledge?.({ ok: false, code: 'INVALID_CONVERSATION_ID' });
        return;
      }
      if (
        !data.conversationIds.has(conversationId)
        && data.conversationIds.size >= config.maximumSocketSubscriptions
      ) {
        acknowledge?.({ ok: false, code: 'SUBSCRIPTION_LIMIT_REACHED' });
        return;
      }
      try {
        data.actor = await identity.authenticateAccessToken(data.token);
        await messaging.authorizeSubscription(data.actor, conversationId);
        await socket.join(roomName(conversationId));
        data.conversationIds.add(conversationId);
        acknowledge?.({ ok: true });
      } catch {
        logger.warn('realtime.subscription.denied', {
          socketId: socket.id,
          userId: data.actor.user.id,
          conversationId,
        });
        acknowledge?.({ ok: false, code: 'CONVERSATION_ACCESS_DENIED' });
      }
    });

    socket.on('conversation.unsubscribe', async (payload: unknown) => {
      const conversationId = readConversationId(payload);
      if (!conversationId) return;
      data.conversationIds.delete(conversationId);
      await socket.leave(roomName(conversationId));
    });

    socket.on('disconnect', (reason) => {
      if (data.revalidationTimer) clearInterval(data.revalidationTimer);
      logger.info('realtime.socket.disconnected', {
        socketId: socket.id,
        userId: data.actor.user.id,
        reason,
      });
    });
  });

  return {
    async publishMessageCreated(message: MessageView): Promise<void> {
      io.to(roomName(message.conversationId)).emit('message.created', {
        conversationId: message.conversationId,
        message,
      });
    },
    async publishPsychologistVerificationUpdated(event): Promise<void> {
      io.to(userRoomName(event.userId)).emit('psychologist.verification.updated', {
        status: event.status,
      });
    },
    async publishAppointmentUpdated(event): Promise<void> {
      for (const userId of event.userIds) {
        io.to(userRoomName(userId)).emit('appointment.updated', {
          appointmentId: event.appointmentId,
          status: event.status,
        });
      }
    },
    async publishAppointmentReminder(event): Promise<void> {
      for (const userId of event.userIds) {
        io.to(userRoomName(userId)).emit('appointment.reminder', {
          appointmentId: event.appointmentId,
          startsAt: event.startsAt,
          minutesBefore: event.minutesBefore,
        });
      }
    },
  };
}
