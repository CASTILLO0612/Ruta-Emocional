import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../../src/app';
import { buildApplicationServices } from '../../src/compositionRoot';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { createTestConfig } from '../support/testConfig';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

interface AuthResponse {
  readonly data: {
    readonly user: { readonly id: string };
    readonly tokens: { readonly accessToken: string };
  };
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

test('MENTA HTTP flow authenticates, persists encrypted turns and returns a safe fallback', {
  skip: !testDatabaseUrl,
}, async () => {
  const databaseUrl = testDatabaseUrl!;
  const baseConfig = createTestConfig(databaseUrl, 'menta-integration');
  const config = {
    ...baseConfig,
    menta: { ...baseConfig.menta, enabled: true },
  };
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const app = createApp({
    config,
    prisma,
    services: buildApplicationServices(config, prisma),
    logger: createLogger('test'),
  });
  const server = http.createServer(app);
  await prisma.$connect();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const api = `http://127.0.0.1:${address.port}/api/v1`;
  const nonce = randomUUID();
  let userId: string | null = null;

  try {
    const registration = await fetch(`${api}/auth/register/patient`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Paciente MENTA',
        email: `menta-${nonce}@example.test`,
        password: 'integration-test-passphrase',
      }),
    });
    assert.equal(registration.status, 201);
    const auth = await json<AuthResponse>(registration);
    userId = auth.data.user.id;
    const headers = {
      authorization: `Bearer ${auth.data.tokens.accessToken}`,
      'content-type': 'application/json',
    };

    const bootstrapResponse = await fetch(`${api}/menta/bootstrap?scope=PATIENT`, { headers });
    assert.equal(bootstrapResponse.status, 200);
    const bootstrap = await json<{ data: { enabled: boolean; conversation: null } }>(bootstrapResponse);
    assert.equal(bootstrap.data.enabled, true);
    assert.equal(bootstrap.data.conversation, null);

    const conversationResponse = await fetch(`${api}/menta/conversations`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ scope: 'PATIENT', consentGranted: true }),
    });
    assert.equal(conversationResponse.status, 201);
    const conversation = await json<{ data: { id: string } }>(conversationResponse);
    const userMessage = 'Necesito una motivación breve para continuar con mi día.';
    const turnResponse = await fetch(
      `${api}/menta/conversations/${conversation.data.id}/turns`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ clientMessageId: randomUUID(), message: userMessage }),
      }
    );
    assert.equal(turnResponse.status, 201);
    const turn = await json<{
      data: { assistantMessage: string; providerOutcome: string; userMessage: string };
    }>(turnResponse);
    assert.equal(turn.data.providerOutcome, 'UNAVAILABLE');
    assert.equal(turn.data.userMessage, userMessage);
    assert.match(turn.data.assistantMessage, /no puedo responder ahora/i);

    const stored = await prisma.mentaTurn.findFirstOrThrow({
      where: { conversationId: conversation.data.id },
      select: { userContentEncrypted: true, assistantContentEncrypted: true },
    });
    assert.equal(stored.userContentEncrypted.includes(userMessage), false);
    assert.equal(stored.assistantContentEncrypted?.includes(turn.data.assistantMessage), false);
  } finally {
    if (userId) {
      const conversations = await prisma.mentaConversation.findMany({
        where: { userId },
        select: { id: true },
      });
      const conversationIds = conversations.map(({ id }) => id);
      const turns = await prisma.mentaTurn.findMany({
        where: { conversationId: { in: conversationIds } },
        select: { id: true },
      });
      await prisma.mentaToolInvocation.deleteMany({
        where: { turnId: { in: turns.map(({ id }) => id) } },
      });
      await prisma.mentaTurn.deleteMany({ where: { conversationId: { in: conversationIds } } });
      await prisma.mentaConversation.deleteMany({ where: { id: { in: conversationIds } } });
      await prisma.auditEvent.deleteMany({ where: { actorUserId: userId } });
      await prisma.authSession.deleteMany({ where: { userId } });
      await prisma.patientProfile.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
