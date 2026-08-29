import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { AddressInfo } from 'node:net';
import { createApp } from '../../src/app';
import { buildApplicationServices } from '../../src/compositionRoot';
import { AppConfig } from '../../src/config/env';
import { PrismaClient } from '../../src/generated/prisma/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { createTestConfig } from '../support/testConfig';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

test('auth HTTP flow persists sessions, rotates refresh tokens and revokes replay', {
  skip: !testDatabaseUrl,
}, async () => {
  const databaseUrl = testDatabaseUrl!;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const config: AppConfig = {
    environment: 'test',
    port: 0,
    databaseUrl,
    allowedOrigins: ['http://localhost:8081'],
    trustProxy: false,
    jsonBodyLimit: '256kb',
    jwt: {
      accessSecret: 'integration-jwt-secret-with-at-least-thirty-two-characters',
      issuer: 'ruta-emocional-api-test',
      audience: 'ruta-emocional-app-test',
      accessTtlSeconds: 900,
      refreshTtlDays: 30,
    },
    password: {
      pepper: 'integration-password-pepper-with-more-than-thirty-two-characters',
      scryptN: 16_384,
      scryptR: 8,
      scryptP: 1,
      keyLength: 32,
    },
    legacyMongo: { enabled: false },
    professionalDirectory: {
      defaultPageSize: 20,
      maxPageSize: 50,
      maxRadiusKm: 100,
      maxAvailabilityWindowDays: 31,
      maxWeeklyRules: 50,
      publicRequestsPerMinute: 120,
      supportedCurrencies: ['NIO'],
    },
    localQa: {
      enabled: false,
      evidenceDirectory: null,
      evidenceMaximumBytes: 5_242_880,
      evidenceUploadsPerMinute: 5,
    },
    requestFlow: {
      minimumAmount: '100.00',
      maximumAmount: '10000.00',
      immediateTtlMinutes: 30,
      scheduledLeadMinutes: 120,
      scheduledOfferCutoffMinutes: 30,
      maximumScheduleDays: 90,
      locationRetentionHours: 24,
      maximumOpenImmediateRequests: 1,
      maximumDescriptionLength: 2000,
      maximumPrimaryNeedLength: 240,
      maximumOfferMessageLength: 500,
      defaultPageSize: 20,
      maximumPageSize: 50,
      idempotencyTtlHours: 24,
      expirationBatchSize: 100,
      mutationsPerMinute: 60,
      serializableMaxRetries: 3,
      serializableRetryBaseDelayMs: 5,
      supportedCurrencies: ['NIO'],
    },
    messaging: createTestConfig(databaseUrl, 'auth-integration').messaging,
    appointments: createTestConfig(databaseUrl, 'auth-integration').appointments,
    clinical: createTestConfig(databaseUrl, 'auth-integration').clinical,
  };

  const logger = createLogger('test');
  const app = createApp({ config, prisma, services: buildApplicationServices(config, prisma), logger });
  const server = http.createServer(app);
  await prisma.$connect();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  const email = `integration-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;

  const userIds: string[] = [];
  try {
    const registration = await fetch(`${baseUrl}/auth/register/patient`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Integration Patient',
        email,
        password: 'integration-test-passphrase',
      }),
    });
    assert.equal(registration.status, 201);
    const registrationBody = await registration.json() as {
      data: { user: { id: string; passwordHash?: unknown }; tokens: { accessToken: string; refreshToken: string } };
    };
    userIds.push(registrationBody.data.user.id);
    assert.equal(registrationBody.data.user.passwordHash, undefined);

    const me = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${registrationBody.data.tokens.accessToken}` },
    });
    assert.equal(me.status, 200);

    const refresh = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: registrationBody.data.tokens.refreshToken }),
    });
    assert.equal(refresh.status, 200);
    const refreshBody = await refresh.json() as { data: { accessToken: string; refreshToken: string } };
    assert.notEqual(refreshBody.data.refreshToken, registrationBody.data.tokens.refreshToken);

    const replay = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: registrationBody.data.tokens.refreshToken }),
    });
    assert.equal(replay.status, 401);

    const revokedAccess = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${refreshBody.data.accessToken}` },
    });
    assert.equal(revokedAccess.status, 401);

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'integration-test-passphrase' }),
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json() as { data: { tokens: { accessToken: string } } };

    const logout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { authorization: `Bearer ${loginBody.data.tokens.accessToken}` },
    });
    assert.equal(logout.status, 204);
    const afterLogout = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${loginBody.data.tokens.accessToken}` },
    });
    assert.equal(afterLogout.status, 401);

    const psychologistEmail = `integration-psychologist-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
    const psychologistRegistration = await fetch(`${baseUrl}/auth/register/psychologist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Integration Psychologist',
        email: psychologistEmail,
        password: 'integration-psychologist-passphrase',
        license: {
          authority: 'MINSA',
          number: `INT-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        },
      }),
    });
    assert.equal(psychologistRegistration.status, 201);
    const psychologistBody = await psychologistRegistration.json() as {
      data: {
        user: {
          id: string;
          roles: string[];
          psychologistVerificationStatus: string;
          capabilities: string[];
        };
        tokens: { accessToken: string };
      };
    };
    userIds.push(psychologistBody.data.user.id);
    assert.deepEqual(psychologistBody.data.user.roles, ['psychologist']);
    assert.equal(psychologistBody.data.user.psychologistVerificationStatus, 'PENDING');
    assert.equal(psychologistBody.data.user.capabilities.includes('psychologist_onboarding:update:self'), true);
    assert.equal(psychologistBody.data.user.capabilities.includes('clinical:write:authorized'), false);

    const psychologistMe = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${psychologistBody.data.tokens.accessToken}` },
    });
    assert.equal(psychologistMe.status, 200);

    const psychologistLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: psychologistEmail,
        password: 'integration-psychologist-passphrase',
        deviceName: 'integration-second-device',
      }),
    });
    assert.equal(psychologistLogin.status, 200);
    const psychologistLoginBody = await psychologistLogin.json() as {
      data: { tokens: { accessToken: string } };
    };

    const logoutAll = await fetch(`${baseUrl}/auth/logout-all`, {
      method: 'POST',
      headers: { authorization: `Bearer ${psychologistLoginBody.data.tokens.accessToken}` },
    });
    assert.equal(logoutAll.status, 204);

    const psychologistRegistrationSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${psychologistBody.data.tokens.accessToken}` },
    });
    assert.equal(psychologistRegistrationSession.status, 401);
    const psychologistLoginSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { authorization: `Bearer ${psychologistLoginBody.data.tokens.accessToken}` },
    });
    assert.equal(psychologistLoginSession.status, 401);
  } finally {
    if (userIds.length > 0) {
      await prisma.$transaction(async (transaction) => {
        await transaction.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
        await transaction.patientProfile.deleteMany({ where: { userId: { in: userIds } } });
        const psychologistProfiles = await transaction.psychologistProfile.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        });
        await transaction.professionalLicense.deleteMany({
          where: { psychologistProfileId: { in: psychologistProfiles.map(({ id }) => id) } },
        });
        await transaction.psychologistProfile.deleteMany({ where: { userId: { in: userIds } } });
        await transaction.user.deleteMany({ where: { id: { in: userIds } } });
      });
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
