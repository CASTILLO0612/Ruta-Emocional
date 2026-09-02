import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { AddressInfo } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../../src/app';
import { buildApplicationServices } from '../../src/compositionRoot';
import { AppConfig } from '../../src/config/env';
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

interface OwnProfileResponse {
  readonly data: {
    readonly id: string;
    readonly licenses: readonly { readonly id: string }[];
  };
}

async function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function authorization(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

test('professional directory HTTP flow protects verification and exposes a minimized public profile', {
  skip: !testDatabaseUrl,
}, async () => {
  const databaseUrl = testDatabaseUrl!;
  const evidenceDirectory = await mkdtemp(path.join(os.tmpdir(), 'ruta-emocional-evidence-'));
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const config: AppConfig = {
    environment: 'test',
    port: 0,
    databaseUrl,
    allowedOrigins: ['http://localhost:8081'],
    trustProxy: false,
    jsonBodyLimit: '256kb',
    secrets: createTestConfig(databaseUrl, 'directory-integration').secrets,
    operations: createTestConfig(databaseUrl, 'directory-integration').operations,
    jwt: {
      accessSecret: 'directory-integration-jwt-secret-with-sufficient-entropy',
      issuer: 'ruta-emocional-api-test',
      audience: 'ruta-emocional-app-test',
      accessTtlSeconds: 900,
      refreshTtlDays: 30,
    },
    password: {
      pepper: 'directory-integration-password-pepper-with-sufficient-entropy',
      scryptN: 16_384,
      scryptR: 8,
      scryptP: 1,
      keyLength: 32,
    },
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
      enabled: true,
      evidenceDirectory,
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
    messaging: createTestConfig(databaseUrl, 'directory-integration').messaging,
    appointments: createTestConfig(databaseUrl, 'directory-integration').appointments,
    clinical: createTestConfig(databaseUrl, 'directory-integration').clinical,
    triage: createTestConfig(databaseUrl, 'directory-integration').triage,
    menta: createTestConfig(databaseUrl, 'directory-integration').menta,
  };

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
  const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const specialtyCode = `INTEGRATION_${Date.now()}`;
  const createdUserIds: string[] = [];
  let psychologistProfileId: string | undefined;
  let specialtyId: string | undefined;

  try {
    const adminRegistration = await fetch(`${baseUrl}/auth/register/patient`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Directory Administrator',
        email: `directory-admin-${nonce}@example.test`,
        password: 'directory-admin-test-passphrase',
      }),
    });
    assert.equal(adminRegistration.status, 201);
    const admin = await json<AuthResponse>(adminRegistration);
    createdUserIds.push(admin.data.user.id);

    const administratorRole = await prisma.role.findUniqueOrThrow({ where: { code: 'administrator' } });
    await prisma.userRole.create({
      data: { userId: admin.data.user.id, roleId: administratorRole.id },
    });

    const specialtyCreation = await fetch(`${baseUrl}/admin/catalogs/specialties`, {
      method: 'POST',
      headers: authorization(admin.data.tokens.accessToken),
      body: JSON.stringify({ code: specialtyCode, name: `Especialidad ${nonce}` }),
    });
    assert.equal(specialtyCreation.status, 201);
    specialtyId = (await prisma.specialty.findUniqueOrThrow({ where: { code: specialtyCode } })).id;

    const psychologistRegistration = await fetch(`${baseUrl}/auth/register/psychologist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Directory Psychologist',
        email: `directory-psychologist-${nonce}@example.test`,
        password: 'directory-psychologist-test-passphrase',
        license: { authority: 'TEST-AUTHORITY', number: `TEST-${nonce}` },
      }),
    });
    assert.equal(psychologistRegistration.status, 201);
    const psychologist = await json<AuthResponse>(psychologistRegistration);
    createdUserIds.push(psychologist.data.user.id);

    const ownResponse = await fetch(`${baseUrl}/psychologists/me`, {
      headers: { authorization: `Bearer ${psychologist.data.tokens.accessToken}` },
    });
    assert.equal(ownResponse.status, 200);
    const own = await json<OwnProfileResponse>(ownResponse);
    psychologistProfileId = own.data.id;
    const licenseId = own.data.licenses[0].id;

    const profilePatch = await fetch(`${baseUrl}/psychologists/me`, {
      method: 'PATCH',
      headers: authorization(psychologist.data.tokens.accessToken),
      body: JSON.stringify({ bio: 'Perfil profesional utilizado exclusivamente para una prueba de integración.' }),
    });
    assert.equal(profilePatch.status, 200);

    const unknownField = await fetch(`${baseUrl}/psychologists/me`, {
      method: 'PATCH',
      headers: authorization(psychologist.data.tokens.accessToken),
      body: JSON.stringify({ bio: 'Perfil profesional utilizado exclusivamente para una prueba de integración.', isVerified: true }),
    });
    assert.equal(unknownField.status, 422);

    const specialtySelection = await fetch(`${baseUrl}/psychologists/me/specialties`, {
      method: 'PUT',
      headers: authorization(psychologist.data.tokens.accessToken),
      body: JSON.stringify({ specialtyCodes: [specialtyCode], primarySpecialtyCode: specialtyCode }),
    });
    assert.equal(specialtySelection.status, 200);

    const modality = await fetch(`${baseUrl}/psychologists/me/modalities/CALL`, {
      method: 'PUT',
      headers: authorization(psychologist.data.tokens.accessToken),
      body: JSON.stringify({
        pricePerHour: { amount: '650.00', currency: 'NIO' },
        isEnabled: true,
      }),
    });
    assert.equal(modality.status, 200);

    const secondModality = await fetch(`${baseUrl}/psychologists/me/modalities/CHAT`, {
      method: 'PUT',
      headers: authorization(psychologist.data.tokens.accessToken),
      body: JSON.stringify({
        pricePerHour: { amount: '800.00', currency: 'NIO' },
        isEnabled: true,
      }),
    });
    assert.equal(secondModality.status, 200);

    const availability = await fetch(`${baseUrl}/psychologists/me/availability`, {
      method: 'PUT',
      headers: authorization(psychologist.data.tokens.accessToken),
      body: JSON.stringify({
        timezone: 'America/Managua',
        rules: [{ weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true }],
      }),
    });
    assert.equal(availability.status, 200);

    const evidenceResponses = await Promise.all([
      'license-front.pdf',
      'license-repeated.pdf',
    ].map((fileName) => fetch(`${baseUrl}/psychologists/me/verification-submissions`, {
      method: 'POST',
      headers: authorization(psychologist.data.tokens.accessToken),
      body: JSON.stringify({
        licenseId,
        evidenceObjectKey: `professional-evidence/${nonce}/${fileName}`,
      }),
    })));
    assert.deepEqual(evidenceResponses.map(({ status }) => status).sort(), [201, 409]);

    const directoryBeforeApproval = await json<{ data: readonly { id: string }[] }>(
      await fetch(`${baseUrl}/psychologists?specialty=${specialtyCode}`)
    );
    assert.equal(directoryBeforeApproval.data.some(({ id }) => id === psychologistProfileId), false);

    const forbiddenQueue = await fetch(`${baseUrl}/admin/psychologist-verifications`, {
      headers: { authorization: `Bearer ${psychologist.data.tokens.accessToken}` },
    });
    assert.equal(forbiddenQueue.status, 403);

    const queueResponse = await fetch(`${baseUrl}/admin/psychologist-verifications`, {
      headers: { authorization: `Bearer ${admin.data.tokens.accessToken}` },
    });
    assert.equal(queueResponse.status, 200);
    const queue = await json<{ data: readonly { submissionId: string; psychologistProfileId: string }[] }>(queueResponse);
    const submission = queue.data.find((item) => item.psychologistProfileId === psychologistProfileId);
    assert.ok(submission);

    const approval = await fetch(
      `${baseUrl}/admin/psychologist-verifications/${submission.submissionId}/decision`,
      {
        method: 'POST',
        headers: authorization(admin.data.tokens.accessToken),
        body: JSON.stringify({ decision: 'APPROVED', internalReason: 'Validated by integration test.' }),
      }
    );
    assert.equal(approval.status, 204);

    const from = new Date();
    const until = new Date(from.getTime() + 7 * 86_400_000);
    const query = new URLSearchParams({
      specialty: specialtyCode,
      modality: 'CALL',
      minPrice: '600',
      maxPrice: '700',
      availableFrom: from.toISOString(),
      availableUntil: until.toISOString(),
    });
    const directoryResponse = await fetch(`${baseUrl}/psychologists?${query}`);
    assert.equal(directoryResponse.status, 200);
    const directory = await json<{ data: readonly Record<string, unknown>[] }>(directoryResponse);
    const publicProfile = directory.data.find(({ id }) => id === psychologistProfileId);
    assert.ok(publicProfile);
    assert.equal(publicProfile.email, undefined);
    assert.equal(publicProfile.licenseNumber, undefined);
    assert.equal(publicProfile.location, undefined);
    assert.equal(publicProfile.evidenceObjectKey, undefined);

    const mismatchedModalityPrice = await json<{ data: readonly { id: string }[] }>(
      await fetch(`${baseUrl}/psychologists?modality=CALL&minPrice=700&maxPrice=900`)
    );
    assert.equal(
      mismatchedModalityPrice.data.some(({ id }) => id === psychologistProfileId),
      false,
      'modality and price filters must match the same configured modality'
    );

    const detailResponse = await fetch(`${baseUrl}/psychologists/${psychologistProfileId}`);
    assert.equal(detailResponse.status, 200);

    const localEvidenceBody = Buffer.from('%PDF-1.7\ncontrolled-local-evidence', 'utf8');
    const localEvidenceUpload = await fetch(
      `${baseUrl}/psychologists/me/verification-evidence/local/${licenseId}`,
      {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${psychologist.data.tokens.accessToken}`,
          'content-type': 'application/pdf',
          'x-evidence-file-name': encodeURIComponent('licencia-local.pdf'),
        },
        body: localEvidenceBody,
      }
    );
    assert.equal(localEvidenceUpload.status, 201);
    const localSubmission = await prisma.professionalVerificationSubmission.findFirstOrThrow({
      where: { professionalLicenseId: licenseId, decision: { is: null } },
      orderBy: { submittedAt: 'desc' },
    });
    const localPrefix = 'local-qa/professional-evidence/';
    assert.ok(localSubmission.evidenceObjectKey.startsWith(localPrefix));
    const storedEvidence = await readFile(path.join(
      evidenceDirectory,
      localSubmission.evidenceObjectKey.slice(localPrefix.length)
    ));
    assert.deepEqual(storedEvidence, localEvidenceBody);

    const secondApproval = await fetch(
      `${baseUrl}/admin/psychologist-verifications/${localSubmission.id}/decision`,
      {
        method: 'POST',
        headers: authorization(admin.data.tokens.accessToken),
        body: JSON.stringify({ decision: 'APPROVED' }),
      }
    );
    assert.equal(secondApproval.status, 204);
    const verificationOutbox = await prisma.outboxEvent.findFirstOrThrow({
      where: {
        aggregateId: psychologistProfileId,
        eventType: 'psychologist.verification_approved',
        payload: { path: ['submissionId'], equals: localSubmission.id },
      },
    });
    assert.equal(
      (verificationOutbox.payload as { userId?: unknown }).userId,
      psychologist.data.user.id
    );
    const verificationAudit = await prisma.auditEvent.findFirstOrThrow({
      where: {
        actorUserId: admin.data.user.id,
        action: 'administrator.psychologist_verification_approved',
        resourceType: 'professional_verification_decision',
        metadata: { path: ['submissionId'], equals: localSubmission.id },
      },
      orderBy: { occurredAt: 'desc' },
    });
    assert.equal(
      (verificationAudit.metadata as { decision?: unknown } | null)?.decision,
      'APPROVED'
    );
  } finally {
    if (createdUserIds.length > 0) {
      await prisma.$transaction(async (transaction) => {
        const profiles = await transaction.psychologistProfile.findMany({
          where: { userId: { in: createdUserIds } },
          select: { id: true },
        });
        const profileIds = profiles.map(({ id }) => id);
        const submissions = await transaction.professionalVerificationSubmission.findMany({
          where: { professionalLicense: { psychologistProfileId: { in: profileIds } } },
          select: { id: true },
        });
        await transaction.professionalVerificationDecision.deleteMany({
          where: { submissionId: { in: submissions.map(({ id }) => id) } },
        });
        await transaction.professionalVerificationSubmission.deleteMany({
          where: { professionalLicense: { psychologistProfileId: { in: profileIds } } },
        });
        await transaction.outboxEvent.deleteMany({
          where: { aggregateType: 'psychologist_profile', aggregateId: { in: profileIds } },
        });
        await transaction.auditEvent.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
        await transaction.availabilityException.deleteMany({ where: { psychologistProfileId: { in: profileIds } } });
        await transaction.availabilityRule.deleteMany({ where: { psychologistProfileId: { in: profileIds } } });
        await transaction.psychologistModality.deleteMany({ where: { psychologistProfileId: { in: profileIds } } });
        await transaction.psychologistSpecialty.deleteMany({ where: { psychologistProfileId: { in: profileIds } } });
        await transaction.professionalLicense.deleteMany({ where: { psychologistProfileId: { in: profileIds } } });
        await transaction.psychologistProfile.deleteMany({ where: { id: { in: profileIds } } });
        await transaction.patientProfile.deleteMany({ where: { userId: { in: createdUserIds } } });
        await transaction.user.deleteMany({ where: { id: { in: createdUserIds } } });
        if (specialtyId) await transaction.specialty.delete({ where: { id: specialtyId } });
      });
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
    assert.ok(evidenceDirectory.startsWith(`${os.tmpdir()}${path.sep}`));
    await rm(evidenceDirectory, { recursive: true, force: true });
  }
});
