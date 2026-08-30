import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import test from 'node:test';
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

interface ClinicalRecordResponse {
  readonly data: {
    readonly patient: { readonly userId: string };
    readonly encounters: readonly {
      readonly id: string;
      readonly note: {
        readonly id: string;
        readonly status: string;
        readonly latestVersionNumber: number;
        readonly content: string;
      };
    }[];
    readonly treatmentPlans: readonly {
      readonly id: string;
      readonly status: string;
      readonly summary: string;
      readonly goals: readonly { readonly id: string; readonly status: string; readonly description: string }[];
    }[];
  };
}

function headers(token: string, idempotencyKey?: string) {
  return {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  };
}

async function register(
  baseUrl: string,
  kind: 'patient' | 'psychologist',
  nonce: string,
  label: string
): Promise<AuthResponse['data']> {
  const response = await fetch(`${baseUrl}/auth/register/${kind}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      displayName: label,
      email: `${label.toLowerCase().replaceAll(' ', '-')}-${nonce}@example.test`,
      password: `${label.toLowerCase().replaceAll(' ', '-')}-secure-test-passphrase`,
      ...(kind === 'psychologist' ? {
        license: { authority: 'MINSA TEST', number: `CL-${label}-${nonce}` },
      } : {}),
    }),
  });
  assert.equal(response.status, 201);
  return (await response.json() as AuthResponse).data;
}

test('clinical HTTP flow encrypts, versions, audits and isolates records', {
  skip: !testDatabaseUrl,
}, async () => {
  const databaseUrl = testDatabaseUrl!;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const config = createTestConfig(databaseUrl, 'clinical-integration');
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

  try {
    const patient = await register(baseUrl, 'patient', nonce, 'Clinical Patient');
    const psychologist = await register(baseUrl, 'psychologist', nonce, 'Clinical Psychologist');
    const outsider = await register(baseUrl, 'psychologist', nonce, 'Outside Psychologist');
    const patientProfile = await prisma.patientProfile.findUniqueOrThrow({
      where: { userId: patient.user.id },
    });
    const psychologistProfile = await prisma.psychologistProfile.update({
      where: { userId: psychologist.user.id },
      data: { verificationStatus: 'VERIFIED' },
    });
    await prisma.psychologistProfile.update({
      where: { userId: outsider.user.id },
      data: { verificationStatus: 'VERIFIED' },
    });
    const relationship = await prisma.careRelationship.create({
      data: {
        patientProfileId: patientProfile.id,
        psychologistProfileId: psychologistProfile.id,
      },
    });

    const initialContent = 'Contenido clínico inicial que no debe persistirse en texto plano.';
    const encounterResponse = await fetch(`${baseUrl}/clinical/encounters`, {
      method: 'POST',
      headers: headers(psychologist.tokens.accessToken, randomUUID()),
      body: JSON.stringify({
        patientUserId: patient.user.id,
        startedAt: new Date().toISOString(),
        reason: 'Consulta de seguimiento clínico',
        noteContent: initialContent,
      }),
    });
    assert.equal(encounterResponse.status, 201);
    let clinical = (await encounterResponse.json() as ClinicalRecordResponse).data;
    assert.equal(clinical.encounters[0]?.note.content, initialContent);
    const noteId = clinical.encounters[0]!.note.id;
    const encounterId = clinical.encounters[0]!.id;
    const rawInitial = await prisma.clinicalNoteVersion.findFirstOrThrow({ where: { clinicalNoteId: noteId } });
    const rawEncounter = await prisma.clinicalEncounter.findUniqueOrThrow({ where: { id: encounterId } });
    assert.notEqual(rawInitial.content, initialContent);
    assert.match(rawInitial.content, /^v1\./);
    assert.notEqual(rawEncounter.reason, 'Consulta de seguimiento clínico');
    assert.match(rawEncounter.reason ?? '', /^v1\./);

    const patientRead = await fetch(`${baseUrl}/clinical/patients`, {
      headers: headers(patient.tokens.accessToken),
    });
    assert.equal(patientRead.status, 403);
    const outsiderRead = await fetch(`${baseUrl}/clinical/patients/${patient.user.id}/record`, {
      headers: headers(outsider.tokens.accessToken),
    });
    assert.equal(outsiderRead.status, 404);

    const updatePayload = (content: string) => ({ expectedVersion: 1, content });
    const [firstUpdate, secondUpdate] = await Promise.all([
      fetch(`${baseUrl}/clinical/notes/${noteId}/draft`, {
        method: 'PUT',
        headers: headers(psychologist.tokens.accessToken, randomUUID()),
        body: JSON.stringify(updatePayload('Primera actualización concurrente de la nota.')),
      }),
      fetch(`${baseUrl}/clinical/notes/${noteId}/draft`, {
        method: 'PUT',
        headers: headers(psychologist.tokens.accessToken, randomUUID()),
        body: JSON.stringify(updatePayload('Segunda actualización concurrente de la nota.')),
      }),
    ]);
    assert.deepEqual([firstUpdate.status, secondUpdate.status].sort(), [200, 409]);
    const winningUpdate = firstUpdate.status === 200 ? firstUpdate : secondUpdate;
    clinical = (await winningUpdate.json() as ClinicalRecordResponse).data;
    assert.equal(clinical.encounters[0]?.note.latestVersionNumber, 2);

    const signResponse = await fetch(`${baseUrl}/clinical/notes/${noteId}/sign`, {
      method: 'POST',
      headers: headers(psychologist.tokens.accessToken, randomUUID()),
      body: JSON.stringify({ expectedVersion: 2 }),
    });
    assert.equal(signResponse.status, 200);
    clinical = (await signResponse.json() as ClinicalRecordResponse).data;
    assert.equal(clinical.encounters[0]?.note.status, 'SIGNED');

    const amendmentContent = 'Contenido clínico corregido sin eliminar la versión firmada.';
    const amendmentResponse = await fetch(`${baseUrl}/clinical/notes/${noteId}/amendments`, {
      method: 'POST',
      headers: headers(psychologist.tokens.accessToken, randomUUID()),
      body: JSON.stringify({
        expectedVersion: 2,
        content: amendmentContent,
        reason: 'Corrección de precisión en la observación registrada.',
      }),
    });
    assert.equal(amendmentResponse.status, 201);
    clinical = (await amendmentResponse.json() as ClinicalRecordResponse).data;
    assert.equal(clinical.encounters[0]?.note.status, 'AMENDED');
    assert.equal(clinical.encounters[0]?.note.latestVersionNumber, 3);
    assert.equal(await prisma.clinicalNoteVersion.count({ where: { clinicalNoteId: noteId } }), 3);
    assert.equal(await prisma.clinicalNoteEvent.count({ where: { clinicalNoteId: noteId } }), 4);

    const versionsResponse = await fetch(`${baseUrl}/clinical/notes/${noteId}/versions`, {
      headers: headers(psychologist.tokens.accessToken),
    });
    assert.equal(versionsResponse.status, 200);
    const versions = (await versionsResponse.json() as {
      readonly data: readonly {
        readonly versionNumber: number;
        readonly content: string;
        readonly amendmentReason: string | null;
      }[];
    }).data;
    assert.deepEqual(versions.map(({ versionNumber }) => versionNumber), [3, 2, 1]);
    assert.equal(versions[0]?.content, amendmentContent);
    assert.equal(
      versions[0]?.amendmentReason,
      'Corrección de precisión en la observación registrada.'
    );
    const rawAmendment = await prisma.clinicalNoteVersion.findUniqueOrThrow({
      where: { clinicalNoteId_versionNumber: { clinicalNoteId: noteId, versionNumber: 3 } },
    });
    assert.notEqual(rawAmendment.amendmentReason, versions[0]?.amendmentReason);
    assert.match(rawAmendment.amendmentReason ?? '', /^v1\./);

    const authorizedRead = await fetch(
      `${baseUrl}/clinical/patients/${patient.user.id}/record`,
      { headers: headers(psychologist.tokens.accessToken) }
    );
    assert.equal(authorizedRead.status, 200);
    assert.equal(
      (await authorizedRead.json() as ClinicalRecordResponse).data.patient.userId,
      patient.user.id
    );

    await assert.rejects(() => prisma.clinicalNoteVersion.update({
      where: { clinicalNoteId_versionNumber: { clinicalNoteId: noteId, versionNumber: 1 } },
      data: { amendmentReason: 'Intento de sobrescritura' },
    }));

    const planSummary = 'Plan de intervención breve con seguimiento de objetivos acordados.';
    const goalDescription = 'Aplicar una estrategia de regulación emocional durante la semana.';
    const planResponse = await fetch(`${baseUrl}/clinical/treatment-plans`, {
      method: 'POST',
      headers: headers(psychologist.tokens.accessToken, randomUUID()),
      body: JSON.stringify({
        patientUserId: patient.user.id,
        summary: planSummary,
        goals: [{ description: goalDescription }],
      }),
    });
    assert.equal(planResponse.status, 201);
    const plan = (await planResponse.json() as { readonly data: ClinicalRecordResponse['data']['treatmentPlans'][number] }).data;
    assert.equal(plan.summary, planSummary);
    const rawPlan = await prisma.treatmentPlan.findUniqueOrThrow({ where: { id: plan.id } });
    const rawGoal = await prisma.treatmentGoal.findUniqueOrThrow({ where: { id: plan.goals[0]!.id } });
    assert.notEqual(rawPlan.summary, planSummary);
    assert.notEqual(rawGoal.description, goalDescription);
    assert.equal(rawPlan.careRelationshipId, relationship.id);

    const activateResponse = await fetch(`${baseUrl}/clinical/treatment-plans/${plan.id}/transitions`, {
      method: 'POST',
      headers: headers(psychologist.tokens.accessToken, randomUUID()),
      body: JSON.stringify({ transition: 'ACTIVATE' }),
    });
    assert.equal(activateResponse.status, 200);
    assert.equal((await activateResponse.json() as { readonly data: { readonly status: string } }).data.status, 'ACTIVE');

    const goalResponse = await fetch(`${baseUrl}/clinical/treatment-goals/${plan.goals[0]!.id}/status`, {
      method: 'PATCH',
      headers: headers(psychologist.tokens.accessToken, randomUUID()),
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    assert.equal(goalResponse.status, 200);
    assert.equal(
      (await goalResponse.json() as { readonly data: { readonly goals: readonly { readonly status: string }[] } }).data.goals[0]?.status,
      'IN_PROGRESS'
    );

    const achieveGoalResponse = await fetch(`${baseUrl}/clinical/treatment-goals/${plan.goals[0]!.id}/status`, {
      method: 'PATCH',
      headers: headers(psychologist.tokens.accessToken, randomUUID()),
      body: JSON.stringify({ status: 'ACHIEVED' }),
    });
    assert.equal(achieveGoalResponse.status, 200);

    const reopenGoalResponse = await fetch(`${baseUrl}/clinical/treatment-goals/${plan.goals[0]!.id}/status`, {
      method: 'PATCH',
      headers: headers(psychologist.tokens.accessToken, randomUUID()),
      body: JSON.stringify({ status: 'PENDING' }),
    });
    assert.equal(reopenGoalResponse.status, 409);

    assert.ok(await prisma.auditEvent.count({
      where: { actorUserId: psychologist.user.id, resourceType: { in: ['clinical_note', 'clinical_record'] } },
    }) >= 5);
    assert.equal((await prisma.clinicalEncounter.findFirstOrThrow({
      where: { clinicalRecord: { patientProfileId: patientProfile.id } },
    })).careRelationshipId, relationship.id);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
