import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import { AddressInfo } from 'node:net';

import { createApp } from '../../src/app';
import { buildApplicationServices } from '../../src/compositionRoot';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { createTestConfig } from '../support/testConfig';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

interface ReadinessResponse {
  readonly status: 'ok' | 'degraded';
  readonly checks: {
    readonly database: string;
    readonly messagingOutbox: string;
  };
}

test('readiness ignores future reminders and reports dead letters without exposing payloads', {
  skip: !testDatabaseUrl,
}, async () => {
  const databaseUrl = testDatabaseUrl!;
  const config = createTestConfig(databaseUrl, 'health-integration');
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const app = createApp({
    config,
    prisma,
    services: buildApplicationServices(config, prisma),
    logger: createLogger('test'),
  });
  const server = http.createServer(app);
  const aggregateId = randomUUID();

  await prisma.$connect();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const readinessUrl = `http://127.0.0.1:${address.port}/api/v1/health/ready`;

  try {
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'health-test',
        aggregateId,
        eventType: 'appointment.reminder_due',
        payload: {
          appointmentId: randomUUID(),
          startsAt: new Date(Date.now() + 86_400_000).toISOString(),
          minutesBefore: 60,
          userIds: [randomUUID()],
        },
        occurredAt: new Date(Date.now() - 86_400_000),
        availableAt: new Date(Date.now() + 82_800_000),
      },
    });

    const healthyResponse = await fetch(readinessUrl);
    assert.equal(healthyResponse.status, 200);
    const healthyBody = await healthyResponse.json() as ReadinessResponse;
    assert.deepEqual(healthyBody, {
      status: 'ok',
      checks: { database: 'ok', messagingOutbox: 'ok' },
    });

    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'health-test',
        aggregateId,
        eventType: 'message.created',
        payload: { messageId: randomUUID(), conversationId: randomUUID() },
        attempts: config.messaging.outboxMaximumAttempts,
        deadLetteredAt: new Date(),
      },
    });

    const degradedResponse = await fetch(readinessUrl);
    assert.equal(degradedResponse.status, 503);
    const degradedBody = await degradedResponse.json() as ReadinessResponse;
    assert.deepEqual(degradedBody, {
      status: 'degraded',
      checks: { database: 'ok', messagingOutbox: 'dead-lettered-events' },
    });
    assert.equal(JSON.stringify(degradedBody).includes('messageId'), false);
  } finally {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId } });
    await new Promise<void>((resolve, reject) => server.close((error) => (
      error ? reject(error) : resolve()
    )));
    await prisma.$disconnect();
  }
});
