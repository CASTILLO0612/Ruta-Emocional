import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { Server } from 'socket.io';
import { io as createClient, Socket } from 'socket.io-client';
import { setupSockets } from '../../src/sockets/socketHandler';
import { IdentityService, AuthenticatedActor } from '../../src/modules/identity/application/identityService';
import { MessagingService } from '../../src/modules/messaging/application/messagingService';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { createTestConfig } from '../support/testConfig';

function actor(userId: string): AuthenticatedActor {
  return {
    sessionId: randomUUID(),
    user: {
      id: userId,
      email: `${userId}@example.test`,
      displayName: 'Socket actor',
      photoUrl: null,
      status: 'ACTIVE',
      roles: ['patient'],
      psychologistVerificationStatus: null,
      capabilities: ['conversation:read:self', 'conversation:send:self'],
    },
  };
}

function connect(url: string, token: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createClient(url, { transports: ['websocket'], auth: { token } });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (error) => {
      socket.disconnect();
      reject(error);
    });
  });
}

test('socket subscriptions require an authenticated conversation participant', async () => {
  const participantId = randomUUID();
  const outsiderId = randomUUID();
  const conversationId = randomUUID();
  const actors = new Map([
    ['participant-token', actor(participantId)],
    ['outsider-token', actor(outsiderId)],
  ]);
  let participantAuthorized = true;
  const identity = {
    authenticateAccessToken: async (token: string) => {
      const authenticated = actors.get(token);
      if (!authenticated) throw new Error('UNAUTHORIZED');
      return authenticated;
    },
  } as unknown as IdentityService;
  const messaging = {
    authorizeSubscription: async (authenticated: AuthenticatedActor, requestedId: string) => {
      if (
        !participantAuthorized
        || authenticated.user.id !== participantId
        || requestedId !== conversationId
      ) {
        throw new Error('CONVERSATION_NOT_FOUND');
      }
    },
    getPolicy: () => ({ maximumTextLength: 4000 }),
  } as unknown as MessagingService;
  const server = http.createServer();
  const io = new Server(server, { serveClient: false });
  const publisher = setupSockets(
    io,
    identity,
    messaging,
    createLogger('test'),
    {
      ...createTestConfig('postgresql://integration.invalid/ruta_emocional', 'socket').messaging,
      socketAuthRevalidationSeconds: 0.02,
    }
  );
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;
  const participant = await connect(url, 'participant-token');
  const outsider = await connect(url, 'outsider-token');

  try {
    await assert.rejects(connect(url, 'invalid-token'), /UNAUTHORIZED/);
    const subscribe = (socket: Socket) => new Promise<{ readonly ok: boolean; readonly code?: string }>(
      (resolve) => socket.emit('conversation.subscribe', { conversationId }, resolve)
    );
    assert.deepEqual(await subscribe(participant), { ok: true });
    assert.deepEqual(await subscribe(outsider), {
      ok: false,
      code: 'CONVERSATION_ACCESS_DENIED',
    });

    const received = new Promise<{ readonly conversationId: string; readonly message: { readonly id: string } }>(
      (resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Socket event timeout')), 2000);
        participant.once('message.created', (event) => {
          clearTimeout(timeout);
          resolve(event);
        });
      }
    );
    const messageId = randomUUID();
    await publisher.publishMessageCreated({
      id: messageId,
      conversationId,
      clientMessageId: randomUUID(),
      type: 'TEXT',
      text: 'Contenido no registrado en logs.',
      sentAt: new Date().toISOString(),
      sender: {
        userId: participantId,
        displayName: 'Socket actor',
        photoUrl: null,
        role: 'patient',
      },
      isOwn: true,
    });
    assert.equal((await received).message.id, messageId);

    const verificationReceived = new Promise<{ readonly status: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Verification event timeout')), 2000);
      participant.once('psychologist.verification.updated', (event) => {
        clearTimeout(timeout);
        resolve(event);
      });
    });
    let outsiderReceivedVerification = false;
    outsider.once('psychologist.verification.updated', () => {
      outsiderReceivedVerification = true;
    });
    await publisher.publishPsychologistVerificationUpdated({
      userId: participantId,
      status: 'VERIFIED',
    });
    assert.deepEqual(await verificationReceived, { status: 'VERIFIED' });
    await new Promise<void>((resolve) => setTimeout(resolve, 30));
    assert.equal(outsiderReceivedVerification, false);

    participantAuthorized = false;
    await new Promise<void>((resolve) => setTimeout(resolve, 80));
    let deliveredAfterRevocation = false;
    participant.once('message.created', () => {
      deliveredAfterRevocation = true;
    });
    await publisher.publishMessageCreated({
      id: randomUUID(),
      conversationId,
      clientMessageId: randomUUID(),
      type: 'TEXT',
      text: 'Este evento no debe llegar después de revocar la relación.',
      sentAt: new Date().toISOString(),
      sender: {
        userId: participantId,
        displayName: 'Socket actor',
        photoUrl: null,
        role: 'patient',
      },
      isOwn: true,
    });
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    assert.equal(deliveredAfterRevocation, false);
  } finally {
    participant.disconnect();
    outsider.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    if (server.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
