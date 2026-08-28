import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApp } from '../../src/app';
import { buildApplicationServices } from '../../src/compositionRoot';
import { Modality, PrismaClient } from '../../src/generated/prisma/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { createTestConfig } from '../support/testConfig';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

interface AuthResponse {
  readonly data: {
    readonly user: { readonly id: string };
    readonly tokens: { readonly accessToken: string };
  };
}

interface AppointmentResponse {
  readonly data: { readonly id: string; readonly status: string };
}

function authorization(token: string) {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

test('appointment HTTP flow is relational, idempotent, authorized and concurrency safe', {
  skip: !testDatabaseUrl,
}, async () => {
  const databaseUrl = testDatabaseUrl!;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const config = createTestConfig(databaseUrl, 'appointment-integration');
  const app = createApp({
    config,
    prisma,
    services: buildApplicationServices(config, prisma),
    logger: createLogger('test'),
  });
  const server = http.createServer(app);
  await prisma.$connect();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userIds: string[] = [];
  let appointmentId: string | undefined;
  let relationshipId: string | undefined;

  try {
    const patientRegistration = await fetch(`${baseUrl}/auth/register/patient`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Appointment Patient',
        email: `appointment-patient-${nonce}@example.test`,
        password: 'appointment-patient-test-passphrase',
      }),
    });
    assert.equal(patientRegistration.status, 201);
    const patient = await patientRegistration.json() as AuthResponse;
    userIds.push(patient.data.user.id);

    const psychologistRegistration = await fetch(`${baseUrl}/auth/register/psychologist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Appointment Psychologist',
        email: `appointment-psychologist-${nonce}@example.test`,
        password: 'appointment-psychologist-test-passphrase',
        license: {
          authority: 'MINSA TEST',
          number: `APT-${nonce}`,
        },
      }),
    });
    assert.equal(psychologistRegistration.status, 201);
    const psychologist = await psychologistRegistration.json() as AuthResponse;
    userIds.push(psychologist.data.user.id);

    const outsiderRegistration = await fetch(`${baseUrl}/auth/register/patient`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: 'Appointment Outsider',
        email: `appointment-outsider-${nonce}@example.test`,
        password: 'appointment-outsider-test-passphrase',
      }),
    });
    assert.equal(outsiderRegistration.status, 201);
    const outsider = await outsiderRegistration.json() as AuthResponse;
    userIds.push(outsider.data.user.id);

    const patientProfile = await prisma.patientProfile.findUniqueOrThrow({
      where: { userId: patient.data.user.id },
    });
    const psychologistProfile = await prisma.psychologistProfile.update({
      where: { userId: psychologist.data.user.id },
      data: { verificationStatus: 'VERIFIED' },
    });
    await prisma.professionalLicense.updateMany({
      where: { psychologistProfileId: psychologistProfile.id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });
    await prisma.psychologistModality.create({
      data: {
        psychologistProfileId: psychologistProfile.id,
        modality: Modality.CALL,
        pricePerHour: '500.00',
        currencyCode: 'NIO',
      },
    });

    const startsAt = new Date(Date.now() + 3 * 86_400_000);
    startsAt.setUTCHours(10, 0, 0, 0);
    const localDate = new Date(Date.UTC(
      startsAt.getUTCFullYear(),
      startsAt.getUTCMonth(),
      startsAt.getUTCDate()
    ));
    await prisma.availabilityRule.create({
      data: {
        psychologistProfileId: psychologistProfile.id,
        weekday: startsAt.getUTCDay(),
        startTime: new Date('1970-01-01T09:00:00.000Z'),
        endTime: new Date('1970-01-01T12:00:00.000Z'),
        timezone: 'UTC',
        effectiveFrom: localDate,
        effectiveUntil: localDate,
      },
    });
    const relationship = await prisma.careRelationship.create({
      data: {
        patientProfileId: patientProfile.id,
        psychologistProfileId: psychologistProfile.id,
      },
    });
    relationshipId = relationship.id;

    const slots = await fetch(
      `${baseUrl}/appointment-slots?${new URLSearchParams({
        careRelationshipId: relationship.id,
        modality: 'CALL',
        from: startsAt.toISOString(),
        until: new Date(startsAt.getTime() + 50 * 60_000).toISOString(),
      })}`,
      { headers: authorization(patient.data.tokens.accessToken) }
    );
    assert.equal(slots.status, 200);
    const slotPayload = await slots.json() as { readonly data: readonly { readonly startsAt: string }[] };
    assert.equal(slotPayload.data[0]?.startsAt, startsAt.toISOString());

    const payload = {
      careRelationshipId: relationship.id,
      modality: 'CALL',
      startsAt: startsAt.toISOString(),
    };
    const firstKey = randomUUID();
    const secondKey = randomUUID();
    const [firstAttempt, secondAttempt] = await Promise.all([
      fetch(`${baseUrl}/appointments`, {
        method: 'POST',
        headers: { ...authorization(patient.data.tokens.accessToken), 'idempotency-key': firstKey },
        body: JSON.stringify(payload),
      }),
      fetch(`${baseUrl}/appointments`, {
        method: 'POST',
        headers: { ...authorization(patient.data.tokens.accessToken), 'idempotency-key': secondKey },
        body: JSON.stringify(payload),
      }),
    ]);
    assert.deepEqual([firstAttempt.status, secondAttempt.status].sort(), [201, 409]);
    const winningResponse = firstAttempt.status === 201 ? firstAttempt : secondAttempt;
    const winningKey = firstAttempt.status === 201 ? firstKey : secondKey;
    const created = await winningResponse.json() as AppointmentResponse;
    appointmentId = created.data.id;
    assert.equal(created.data.status, 'SCHEDULED');

    const replay = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: { ...authorization(patient.data.tokens.accessToken), 'idempotency-key': winningKey },
      body: JSON.stringify(payload),
    });
    assert.equal(replay.status, 201);
    assert.equal((await replay.json() as AppointmentResponse).data.id, appointmentId);

    const outsiderList = await fetch(`${baseUrl}/appointments?scope=UPCOMING`, {
      headers: authorization(outsider.data.tokens.accessToken),
    });
    assert.equal(outsiderList.status, 200);
    assert.deepEqual((await outsiderList.json() as { readonly data: readonly unknown[] }).data, []);
    const outsiderMutation = await fetch(`${baseUrl}/appointments/${appointmentId}/transitions`, {
      method: 'POST',
      headers: {
        ...authorization(outsider.data.tokens.accessToken),
        'idempotency-key': randomUUID(),
      },
      body: JSON.stringify({ transition: 'CANCEL', reason: 'Intento no autorizado.' }),
    });
    assert.equal(outsiderMutation.status, 404);

    const confirmation = await fetch(`${baseUrl}/appointments/${appointmentId}/transitions`, {
      method: 'POST',
      headers: {
        ...authorization(psychologist.data.tokens.accessToken),
        'idempotency-key': randomUUID(),
      },
      body: JSON.stringify({ transition: 'CONFIRM' }),
    });
    assert.equal(confirmation.status, 200);
    assert.equal((await confirmation.json() as AppointmentResponse).data.status, 'CONFIRMED');

    assert.equal(await prisma.appointmentEvent.count({ where: { appointmentId } }), 2);
    assert.equal(await prisma.auditEvent.count({
      where: { resourceType: 'appointment', resourceId: appointmentId },
    }), 2);
    assert.equal(await prisma.outboxEvent.count({
      where: { aggregateType: 'appointment', aggregateId: appointmentId },
    }), 4);
    assert.equal(await prisma.outboxEvent.count({
      where: {
        aggregateType: 'appointment',
        aggregateId: appointmentId,
        eventType: 'appointment.reminder_due',
      },
    }), 2);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$transaction(async (transaction) => {
      if (appointmentId) {
        await transaction.appointmentEvent.deleteMany({ where: { appointmentId } });
        await transaction.appointmentCareRelationship.deleteMany({ where: { appointmentId } });
        await transaction.appointment.deleteMany({ where: { id: appointmentId } });
      }
      if (relationshipId) {
        await transaction.careRelationship.deleteMany({ where: { id: relationshipId } });
      }
      const professional = await transaction.psychologistProfile.findFirst({
        where: { userId: { in: userIds } },
        select: { id: true },
      });
      if (professional) {
        await transaction.availabilityRule.deleteMany({ where: { psychologistProfileId: professional.id } });
        await transaction.psychologistModality.deleteMany({ where: { psychologistProfileId: professional.id } });
        await transaction.professionalLicense.deleteMany({ where: { psychologistProfileId: professional.id } });
      }
      await transaction.idempotencyRecord.deleteMany({ where: { actorUserId: { in: userIds } } });
      await transaction.outboxEvent.deleteMany({
        where: appointmentId ? { aggregateId: appointmentId } : { aggregateType: 'appointment' },
      });
      await transaction.auditEvent.deleteMany({
        where: {
          OR: [
            { actorUserId: { in: userIds } },
            ...(appointmentId ? [{ resourceId: appointmentId }] : []),
          ],
        },
      });
      await transaction.psychologistProfile.deleteMany({ where: { userId: { in: userIds } } });
      await transaction.patientProfile.deleteMany({ where: { userId: { in: userIds } } });
      await transaction.authSession.deleteMany({ where: { userId: { in: userIds } } });
      await transaction.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await transaction.user.deleteMany({ where: { id: { in: userIds } } });
    });
    await prisma.$disconnect();
  }
});
