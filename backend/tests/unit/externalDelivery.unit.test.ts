import assert from 'node:assert/strict';
import test from 'node:test';
import type { S3Client } from '@aws-sdk/client-s3';
import type { PrismaClient } from '../../src/generated/prisma/client';
import { AppError } from '../../src/shared/domain/appError';
import type { Logger } from '../../src/shared/infrastructure/logging/logger';
import { ResendPasswordResetDelivery } from '../../src/modules/identity/infrastructure/delivery/resendPasswordResetDelivery';
import { renderPasswordResetLandingPage } from '../../src/modules/identity/presentation/passwordResetLandingPage';
import { PushNotificationDispatcher } from '../../src/modules/notification/infrastructure/outbox/pushNotificationDispatcher';
import { ExpoPushProvider } from '../../src/modules/notification/infrastructure/providers/expoPushProvider';
import {
  parseInstallationId,
  parsePushDevice,
} from '../../src/modules/notification/presentation/notificationValidation';
import { S3QuarantineObjectStore } from '../../src/shared/infrastructure/storage/s3QuarantineObjectStore';
import { createTestConfig } from '../support/testConfig';

type FetchCall = {
  readonly input: string | URL | Request;
  readonly init?: RequestInit;
};

function captureFetch(response: Response): {
  readonly calls: FetchCall[];
  readonly restore: () => void;
} {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return response;
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

test('Resend sends a password reset exactly once per recovery record', async () => {
  const capture = captureFetch(new Response(JSON.stringify({ id: 'email-1' }), { status: 200 }));
  try {
    const delivery = new ResendPasswordResetDelivery({
      apiKey: 're_test_delivery_key',
      sender: 'Ruta Emocional <acceso@rutaemocional.example>',
      resetUrl: 'https://app.rutaemocional.example/restablecer-contrasena',
      timeoutMs: 1_000,
    });
    await delivery.send({
      deliveryId: '00000000-0000-4000-8000-000000000001',
      recipientEmail: 'persona@example.com',
      displayName: '<Persona>',
      token: 'one-time-token',
      expiresAt: new Date('2026-10-06T18:00:00.000Z'),
    });

    assert.equal(capture.calls.length, 1);
    const request = capture.calls[0];
    assert.equal(request.input, 'https://api.resend.com/emails');
    assert.equal(
      new Headers(request.init?.headers).get('idempotency-key'),
      'password-reset/00000000-0000-4000-8000-000000000001'
    );
    const body = JSON.parse(String(request.init?.body)) as Record<string, unknown>;
    assert.deepEqual(body.to, ['persona@example.com']);
    assert.match(String(body.html), /&lt;Persona&gt;/);
    assert.doesNotMatch(String(body.html), /<Persona>/);
    assert.match(String(body.html), /https:\/\/app\.rutaemocional\.example\/restablecer-contrasena\?token=one-time-token/);
    assert.match(String(body.text), /https:\/\/app\.rutaemocional\.example\/restablecer-contrasena\?token=one-time-token/);
    assert.doesNotMatch(String(body.html), /href="rutaemocional:\/\//);
  } finally {
    capture.restore();
  }
});

test('password reset landing page only opens the app for a valid opaque token', () => {
  const token = 'a'.repeat(43);
  const valid = renderPasswordResetLandingPage(token);
  assert.equal(valid.status, 200);
  assert.match(valid.html, new RegExp(`href="rutaemocional://restablecer-contrasena\\?token=${token}"`));
  assert.match(valid.html, /Abrir Ruta Emocional/);

  const invalid = renderPasswordResetLandingPage('<script>alert(1)</script>');
  assert.equal(invalid.status, 400);
  assert.doesNotMatch(invalid.html, /rutaemocional:\/\//);
  assert.doesNotMatch(invalid.html, /<script>/);
});

test('Resend translates provider failures into a stable public error', async () => {
  const capture = captureFetch(new Response('unavailable', { status: 503 }));
  try {
    const delivery = new ResendPasswordResetDelivery({
      apiKey: 're_test_delivery_key',
      sender: 'acceso@rutaemocional.example',
      resetUrl: 'https://app.rutaemocional.example/restablecer-contrasena',
      timeoutMs: 1_000,
    });
    await assert.rejects(
      delivery.send({
        deliveryId: '00000000-0000-4000-8000-000000000001',
        recipientEmail: 'persona@example.com',
        displayName: 'Persona',
        token: 'one-time-token',
        expiresAt: new Date('2026-10-06T18:00:00.000Z'),
      }),
      (error: unknown) => error instanceof AppError
        && error.code === 'PASSWORD_RESET_DELIVERY_FAILED'
        && !error.message.includes('503')
    );
  } finally {
    capture.restore();
  }
});

test('Expo push provider sends privacy-safe payloads and reads tickets', async () => {
  const capture = captureFetch(new Response(JSON.stringify({
    data: { status: 'ok', id: 'ticket-1' },
  }), { status: 200, headers: { 'content-type': 'application/json' } }));
  try {
    const provider = new ExpoPushProvider({ accessToken: 'expo-token', timeoutMs: 1_000 });
    const ticket = await provider.send({
      to: 'ExponentPushToken[abcdefghijklmnop]',
      title: 'Ruta Emocional',
      body: 'Tienes una actualización nueva.',
      data: { kind: 'APPOINTMENT', appointmentId: 'appointment-1' },
    });

    assert.deepEqual(ticket, { status: 'ok', id: 'ticket-1', errorCode: undefined });
    assert.equal(new Headers(capture.calls[0].init?.headers).get('authorization'), 'Bearer expo-token');
    const body = JSON.parse(String(capture.calls[0].init?.body)) as Record<string, unknown>;
    assert.equal(body.priority, 'high');
    assert.deepEqual(body.data, { kind: 'APPOINTMENT', appointmentId: 'appointment-1' });
  } finally {
    capture.restore();
  }
});

test('push receipts are delayed again when Expo has not produced them yet', async () => {
  const pushConfig = createTestConfig(
    'postgresql://test:test@localhost:5432/ruta_emocional_test',
    'external-delivery'
  ).pushNotifications;
  const updates: Array<Record<string, unknown>> = [];
  const prisma = {
    $queryRaw: async () => [],
    pushDelivery: {
      findMany: async () => [{
        id: 'delivery-1',
        providerTicketId: 'ticket-1',
        pushDeviceId: 'device-1',
      }],
      updateMany: async (input: Record<string, unknown>) => {
        updates.push(input);
        return { count: 1 };
      },
    },
  } as unknown as PrismaClient;
  const provider = {
    receipts: async (ids: readonly string[]) => {
      assert.deepEqual(ids, ['ticket-1']);
      return {};
    },
  } as unknown as ExpoPushProvider;
  const logger = { error: () => undefined } as unknown as Logger;
  const startedAt = Date.now();
  const dispatcher = new PushNotificationDispatcher(
    prisma,
    provider,
    logger,
    pushConfig
  );

  assert.equal(await dispatcher.drainOnce(), 0);
  assert.equal(updates.length, 1);
  const data = updates[0].data as Record<string, unknown>;
  assert.ok(data.receiptCheckedAt instanceof Date);
  assert.ok(data.availableAt instanceof Date);
  assert.ok(data.availableAt.getTime() >= startedAt + pushConfig.receiptRetryDelayMs);
});

test('push device validation rejects forged identifiers and malformed tokens', () => {
  const valid = parsePushDevice({
    installationId: '00000000-0000-4000-8000-000000000001',
    expoPushToken: 'ExponentPushToken[abcdefghijklmnop]',
    platform: 'ANDROID',
  });
  assert.equal(valid.platform, 'ANDROID');
  assert.equal(parseInstallationId(valid.installationId), valid.installationId);
  assert.throws(() => parsePushDevice({
    installationId: '../another-device',
    expoPushToken: 'token',
    platform: 'ANDROID',
  }), AppError);
});

test('S3 quarantine storage writes private tagged objects and recognizes GuardDuty results', async () => {
  const commands: unknown[] = [];
  const client = {
    send: async (command: unknown) => {
      commands.push(command);
      if (commands.length === 2) {
        return {
          TagSet: [{ Key: 'GuardDutyMalwareScanStatus', Value: 'NO_THREATS_FOUND' }],
        };
      }
      return {};
    },
  } as unknown as S3Client;
  const storage = new S3QuarantineObjectStore(client, 'private-media');

  await storage.put('quarantine/profile-photos/user/photo.jpg', new Uint8Array([1, 2, 3]), 'image/jpeg');
  assert.equal(await storage.guardDutyStatus('quarantine/profile-photos/user/photo.jpg'), 'NO_THREATS_FOUND');

  const putInput = (commands[0] as { readonly input: Record<string, unknown> }).input;
  assert.equal(putInput.Bucket, 'private-media');
  assert.equal(putInput.Tagging, 'uploadState=quarantine');
  assert.equal(putInput.ServerSideEncryption, 'AES256');
});
