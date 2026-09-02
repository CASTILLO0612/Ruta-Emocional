import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApp } from '../../src/app';
import { buildApplicationServices } from '../../src/compositionRoot';
import {
  Modality,
  PrismaClient,
  VerificationStatus,
} from '../../src/generated/prisma/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { createTestConfig } from '../support/testConfig';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

interface Actor {
  readonly userId: string;
  readonly accessToken: string;
}

interface AuthEnvelope {
  readonly data: {
    readonly user: { readonly id: string };
    readonly tokens: { readonly accessToken: string };
  };
}

interface TriageEnvelope {
  readonly data: {
    readonly id: string;
    readonly riskLevel: string;
    readonly providerOutcome: string;
    readonly recommendedModalities: readonly string[];
    readonly requiresImmediateHelp: boolean;
    readonly safetyActions: readonly string[];
    readonly crisisResources: readonly { readonly code: string }[];
    readonly reviewedAt: string | null;
    readonly reviewedBy: { readonly userId: string } | null;
    readonly consentWithdrawnAt: string | null;
    readonly erasureRequest: {
      readonly id: string;
      readonly status: string;
      readonly policyVersion: string;
      readonly requestedAt: string;
      readonly dueAt: string;
    } | null;
  };
}

interface PolicyEnvelope {
  readonly data: {
    readonly consentDocument: { readonly code: string; readonly version: string };
    readonly questions: readonly { readonly code: string; readonly options: readonly { readonly code: string }[] }[];
  };
}

function headers(accessToken: string, idempotencyKey?: string) {
  return {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  };
}

async function register(
  baseUrl: string,
  role: 'patient' | 'psychologist',
  nonce: string,
  label: string
): Promise<Actor> {
  const response = await fetch(`${baseUrl}/auth/register/${role}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      displayName: `${label} ${role}`,
      email: `${label.toLowerCase()}-${role}-${nonce}@example.test`,
      password: `${label.toLowerCase()}-${role}-secure-test-passphrase`,
      ...(role === 'psychologist'
        ? { license: { authority: 'TRIAGE TEST', number: `${label}-${nonce}` } }
        : {}),
    }),
  });
  assert.equal(response.status, 201);
  const body = await response.json() as AuthEnvelope;
  return { userId: body.data.user.id, accessToken: body.data.tokens.accessToken };
}

function requestBody(label: string) {
  return {
    modality: 'CHAT',
    primaryNeed: 'Acompañamiento emocional',
    description: `Solicitud para la prueba segura de triaje ${label}.`,
    proposedBudget: { amount: '600.00', currency: 'NIO' },
    timing: { kind: 'IMMEDIATE' },
  };
}

function assessmentBody(
  serviceRequestId: string,
  consent: PolicyEnvelope['data']['consentDocument'],
  safetyOption: 'SAFETY_SAFE_NOW' | 'SAFETY_UNSAFE_NOW'
) {
  return {
    countryCode: 'NI',
    serviceRequestId,
    answers: [
      { questionCode: 'PRIMARY_NEED', optionCode: 'NEED_ANXIETY_STRESS' },
      { questionCode: 'SUPPORT_PREFERENCE', optionCode: 'PREFERENCE_CHAT' },
      { questionCode: 'CURRENT_SAFETY', optionCode: safetyOption },
      { questionCode: 'SELF_HARM', optionCode: 'SELF_HARM_NONE' },
      { questionCode: 'HARM_OTHERS', optionCode: 'HARM_OTHERS_NONE' },
      { questionCode: 'VIOLENCE_ABUSE', optionCode: 'VIOLENCE_ABUSE_NO' },
    ],
    consent: {
      documentCode: consent.code,
      documentVersion: consent.version,
      granted: true,
    },
  };
}

test('triage HTTP flow is deterministic, private, immutable, reviewable and interrupts critical commerce', {
  skip: !testDatabaseUrl,
}, async () => {
  const databaseUrl = testDatabaseUrl!;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const config = createTestConfig(databaseUrl, 'triage-integration');
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
  const nonce = `${Date.now()}-${randomUUID()}`;
  const actors: Actor[] = [];

  try {
    const patient = await register(baseUrl, 'patient', nonce, 'Owner');
    const outsider = await register(baseUrl, 'patient', nonce, 'Outsider');
    const professional = await register(baseUrl, 'psychologist', nonce, 'Responsible');
    actors.push(patient, outsider, professional);

    const professionalProfile = await prisma.psychologistProfile.update({
      where: { userId: professional.userId },
      data: { verificationStatus: VerificationStatus.VERIFIED },
    });
    await prisma.professionalLicense.updateMany({
      where: { psychologistProfileId: professionalProfile.id },
      data: { status: VerificationStatus.VERIFIED, verifiedAt: new Date() },
    });
    await prisma.psychologistModality.create({
      data: {
        psychologistProfileId: professionalProfile.id,
        modality: Modality.CHAT,
        pricePerHour: '500.00',
        currencyCode: 'NIO',
      },
    });

    const policyResponse = await fetch(`${baseUrl}/triage/policy`, {
      headers: headers(patient.accessToken),
    });
    assert.equal(policyResponse.status, 200);
    const policy = await policyResponse.json() as PolicyEnvelope;
    assert.equal(policy.data.questions.length, 6);

    const createRequest = async (label: string) => {
      const response = await fetch(`${baseUrl}/service-requests`, {
        method: 'POST',
        headers: headers(patient.accessToken, randomUUID()),
        body: JSON.stringify(requestBody(label)),
      });
      assert.equal(response.status, 201);
      return (await response.json() as { readonly data: { readonly id: string } }).data.id;
    };
    const createOffer = async (requestId: string) => {
      const response = await fetch(`${baseUrl}/service-requests/${requestId}/offers`, {
        method: 'POST',
        headers: headers(professional.accessToken, randomUUID()),
        body: JSON.stringify({ price: { amount: '500.00' } }),
      });
      assert.equal(response.status, 201);
      return (await response.json() as { readonly data: { readonly id: string } }).data.id;
    };

    const lowRequestId = await createRequest('low');
    const lowPayload = assessmentBody(
      lowRequestId,
      policy.data.consentDocument,
      'SAFETY_SAFE_NOW'
    );
    const lowKey = randomUUID();
    const lowResponse = await fetch(`${baseUrl}/triage/assessments`, {
      method: 'POST',
      headers: headers(patient.accessToken, lowKey),
      body: JSON.stringify(lowPayload),
    });
    assert.equal(lowResponse.status, 201);
    const lowText = await lowResponse.text();
    assert.equal(lowText.includes('suggestedBudget'), false);
    assert.equal(lowText.includes('proposedBudget'), false);
    const low = JSON.parse(lowText) as TriageEnvelope;
    assert.equal(low.data.riskLevel, 'LOW');
    assert.equal(low.data.providerOutcome, 'NOT_USED');
    assert.deepEqual(low.data.recommendedModalities, ['CHAT', 'CALL', 'IN_PERSON']);
    assert.equal(low.data.requiresImmediateHelp, false);

    const lowReplay = await fetch(`${baseUrl}/triage/assessments`, {
      method: 'POST',
      headers: headers(patient.accessToken, lowKey),
      body: JSON.stringify(lowPayload),
    });
    assert.equal(lowReplay.status, 201);
    assert.equal((await lowReplay.json() as TriageEnvelope).data.id, low.data.id);
    const changedReplay = await fetch(`${baseUrl}/triage/assessments`, {
      method: 'POST',
      headers: headers(patient.accessToken, lowKey),
      body: JSON.stringify({
        ...lowPayload,
        answers: lowPayload.answers.map((answer) => answer.questionCode === 'SUPPORT_PREFERENCE'
          ? { ...answer, optionCode: 'PREFERENCE_CALL' }
          : answer),
      }),
    });
    assert.equal(changedReplay.status, 409);

    assert.equal(await prisma.triageAssessmentRuleResult.count({
      where: { triageAssessmentId: low.data.id },
    }), 6);
    assert.equal(await prisma.patientConsent.count({
      where: { triageAssessments: { some: { id: low.data.id } } },
    }), 1);

    const outsiderRead = await fetch(`${baseUrl}/triage/assessments/${low.data.id}`, {
      headers: headers(outsider.accessToken),
    });
    assert.equal(outsiderRead.status, 404);
    const professionalBeforeAcceptance = await fetch(
      `${baseUrl}/triage/assessments/${low.data.id}`,
      { headers: headers(professional.accessToken) }
    );
    assert.equal(professionalBeforeAcceptance.status, 404);

    const lowOfferId = await createOffer(lowRequestId);
    const acceptance = await fetch(
      `${baseUrl}/service-requests/${lowRequestId}/offers/${lowOfferId}/accept`,
      { method: 'POST', headers: headers(patient.accessToken, randomUUID()) }
    );
    assert.equal(acceptance.status, 200);
    const source = await prisma.careRelationshipSource.findUniqueOrThrow({
      where: { acceptedOfferId: lowOfferId },
      select: { triageAssessmentId: true },
    });
    assert.equal(source.triageAssessmentId, low.data.id);

    const clinicalPatients = await fetch(`${baseUrl}/clinical/patients`, {
      headers: headers(professional.accessToken),
    });
    assert.equal(clinicalPatients.status, 200);
    const clinicalPage = await clinicalPatients.json() as {
      readonly data: readonly { readonly triageAssessmentId: string | null }[];
    };
    assert.equal(clinicalPage.data[0]?.triageAssessmentId, low.data.id);

    const professionalRead = await fetch(`${baseUrl}/triage/assessments/${low.data.id}`, {
      headers: headers(professional.accessToken),
    });
    assert.equal(professionalRead.status, 200);
    const [review, reviewReplay] = await Promise.all([
      fetch(`${baseUrl}/triage/assessments/${low.data.id}/review`, {
        method: 'POST',
        headers: headers(professional.accessToken),
      }),
      fetch(`${baseUrl}/triage/assessments/${low.data.id}/review`, {
        method: 'POST',
        headers: headers(professional.accessToken),
      }),
    ]);
    assert.equal(review.status, 200);
    assert.equal(reviewReplay.status, 200);
    const reviewed = await review.json() as TriageEnvelope;
    assert.equal(reviewed.data.reviewedBy?.userId, professional.userId);
    assert.ok(reviewed.data.reviewedAt);
    assert.equal(await prisma.auditEvent.count({
      where: {
        resourceId: low.data.id,
        action: 'triage.assessment_reviewed',
      },
    }), 1);

    await assert.rejects(
      () => prisma.triageAssessment.update({
        where: { id: low.data.id },
        data: { riskLevel: 'HIGH' },
      }),
      /Triage assessment output is immutable/
    );

    const privacyRequestId = await createRequest('privacy');
    const privacyResponse = await fetch(`${baseUrl}/triage/assessments`, {
      method: 'POST',
      headers: headers(patient.accessToken, randomUUID()),
      body: JSON.stringify(assessmentBody(
        privacyRequestId,
        policy.data.consentDocument,
        'SAFETY_SAFE_NOW'
      )),
    });
    assert.equal(privacyResponse.status, 201);
    const privacyAssessment = await privacyResponse.json() as TriageEnvelope;

    const outsiderWithdrawal = await fetch(
      `${baseUrl}/triage/assessments/${privacyAssessment.data.id}/consent-withdrawal`,
      { method: 'POST', headers: headers(outsider.accessToken) }
    );
    assert.equal(outsiderWithdrawal.status, 404);

    const withdrawalResponse = await fetch(
      `${baseUrl}/triage/assessments/${privacyAssessment.data.id}/consent-withdrawal`,
      { method: 'POST', headers: headers(patient.accessToken) }
    );
    assert.equal(withdrawalResponse.status, 200);
    const withdrawn = await withdrawalResponse.json() as TriageEnvelope;
    assert.ok(withdrawn.data.consentWithdrawnAt);
    const withdrawalReplay = await fetch(
      `${baseUrl}/triage/assessments/${privacyAssessment.data.id}/consent-withdrawal`,
      { method: 'POST', headers: headers(patient.accessToken) }
    );
    assert.equal(withdrawalReplay.status, 200);

    const erasureResponse = await fetch(
      `${baseUrl}/triage/assessments/${privacyAssessment.data.id}/erasure-request`,
      { method: 'POST', headers: headers(patient.accessToken) }
    );
    assert.equal(erasureResponse.status, 202);
    const erasure = await erasureResponse.json() as TriageEnvelope;
    assert.equal(erasure.data.erasureRequest?.status, 'BLOCKED');
    assert.equal(erasure.data.erasureRequest?.policyVersion, config.triage.retentionPolicy.version);
    assert.ok(erasure.data.erasureRequest?.dueAt);
    const erasureReplay = await fetch(
      `${baseUrl}/triage/assessments/${privacyAssessment.data.id}/erasure-request`,
      { method: 'POST', headers: headers(patient.accessToken) }
    );
    assert.equal(erasureReplay.status, 202);
    assert.equal(
      (await erasureReplay.json() as TriageEnvelope).data.erasureRequest?.id,
      erasure.data.erasureRequest?.id
    );
    assert.equal(await prisma.patientConsent.count({
      where: {
        patientProfile: { userId: patient.userId },
        decision: 'WITHDRAWN',
        triageConsentWithdrawal: { is: { triageAssessmentId: privacyAssessment.data.id } },
      },
    }), 1);
    assert.equal(await prisma.auditEvent.count({
      where: {
        resourceId: privacyAssessment.data.id,
        action: { in: ['triage.consent_withdrawn', 'triage.erasure_requested'] },
      },
    }), 2);

    const privacyOfferId = await createOffer(privacyRequestId);
    const privacyBlocked = await fetch(
      `${baseUrl}/service-requests/${privacyRequestId}/offers/${privacyOfferId}/accept`,
      { method: 'POST', headers: headers(patient.accessToken, randomUUID()) }
    );
    assert.equal(privacyBlocked.status, 409);
    assert.equal(
      (await privacyBlocked.json() as { readonly code: string }).code,
      'TRIAGE_PROCESSING_RESTRICTED'
    );
    await prisma.$transaction([
      prisma.offer.update({
        where: { id: privacyOfferId },
        data: { status: 'REJECTED' },
      }),
      prisma.serviceRequest.update({
        where: { id: privacyRequestId },
        data: { status: 'CANCELLED' },
      }),
    ]);

    const criticalRequestId = await createRequest('critical');
    const criticalResponse = await fetch(`${baseUrl}/triage/assessments`, {
      method: 'POST',
      headers: headers(patient.accessToken, randomUUID()),
      body: JSON.stringify(assessmentBody(
        criticalRequestId,
        policy.data.consentDocument,
        'SAFETY_UNSAFE_NOW'
      )),
    });
    assert.equal(criticalResponse.status, 201);
    const criticalText = await criticalResponse.text();
    assert.equal(criticalText.includes('budget'), false);
    const critical = JSON.parse(criticalText) as TriageEnvelope;
    assert.equal(critical.data.riskLevel, 'CRITICAL');
    assert.deepEqual(critical.data.recommendedModalities, []);
    assert.equal(critical.data.requiresImmediateHelp, true);
    assert.ok(critical.data.safetyActions.length > 0);
    assert.equal(critical.data.crisisResources[0].code, 'TEST_EMERGENCY');

    await assert.rejects(
      () => prisma.triageAssessmentModality.create({
        data: {
          triageAssessmentId: critical.data.id,
          modality: Modality.CHAT,
          priority: 1,
        },
      }),
      /High or critical triage cannot contain commercial modality recommendations/
    );

    const criticalOfferId = await createOffer(criticalRequestId);
    const blockedAcceptance = await fetch(
      `${baseUrl}/service-requests/${criticalRequestId}/offers/${criticalOfferId}/accept`,
      { method: 'POST', headers: headers(patient.accessToken, randomUUID()) }
    );
    assert.equal(blockedAcceptance.status, 409);
    const blockedProblem = await blockedAcceptance.json() as { readonly code: string };
    assert.equal(blockedProblem.code, 'CRITICAL_TRIAGE_INTERRUPTS_COMMERCIAL_FLOW');
  } finally {
    const userIds = actors.map(({ userId }) => userId);
    if (userIds.length) {
      await prisma.$transaction(async (transaction) => {
        const patientProfiles = await transaction.patientProfile.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        });
        const patientProfileIds = patientProfiles.map(({ id }) => id);
        const requests = await transaction.serviceRequest.findMany({
          where: { patientProfileId: { in: patientProfileIds } },
          select: { id: true },
        });
        const requestIds = requests.map(({ id }) => id);
        const sources = await transaction.careRelationshipSource.findMany({
          where: { acceptedOffer: { requestId: { in: requestIds } } },
          select: { careRelationshipId: true },
        });
        const relationshipIds = sources.map(({ careRelationshipId }) => careRelationshipId);
        const conversationIds = (await transaction.conversation.findMany({
          where: { careRelationshipId: { in: relationshipIds } },
          select: { id: true },
        })).map(({ id }) => id);
        await transaction.conversationParticipant.deleteMany({
          where: { conversationId: { in: conversationIds } },
        });
        await transaction.conversation.deleteMany({ where: { id: { in: conversationIds } } });
        await transaction.careRelationshipSource.deleteMany({
          where: { careRelationshipId: { in: relationshipIds } },
        });
        await transaction.careRelationship.deleteMany({ where: { id: { in: relationshipIds } } });
        await transaction.offer.deleteMany({ where: { requestId: { in: requestIds } } });
        await transaction.requestTriageAssessment.deleteMany({
          where: { serviceRequestId: { in: requestIds } },
        });
        await transaction.serviceRequest.deleteMany({ where: { id: { in: requestIds } } });
        await transaction.triageErasureRequest.deleteMany({
          where: { patientProfileId: { in: patientProfileIds } },
        });
        await transaction.triageConsentWithdrawal.deleteMany({
          where: { patientProfileId: { in: patientProfileIds } },
        });
        await transaction.triageAssessment.deleteMany({
          where: { patientProfileId: { in: patientProfileIds } },
        });
        await transaction.patientConsent.deleteMany({
          where: { patientProfileId: { in: patientProfileIds } },
        });
        await transaction.idempotencyRecord.deleteMany({ where: { actorUserId: { in: userIds } } });
        await transaction.outboxEvent.deleteMany({
          where: { aggregateId: { in: [...requestIds, ...conversationIds] } },
        });
        await transaction.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
        const professionalProfiles = await transaction.psychologistProfile.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        });
        const professionalProfileIds = professionalProfiles.map(({ id }) => id);
        await transaction.psychologistModality.deleteMany({
          where: { psychologistProfileId: { in: professionalProfileIds } },
        });
        await transaction.professionalLicense.deleteMany({
          where: { psychologistProfileId: { in: professionalProfileIds } },
        });
        await transaction.psychologistProfile.deleteMany({
          where: { id: { in: professionalProfileIds } },
        });
        await transaction.patientProfile.deleteMany({ where: { id: { in: patientProfileIds } } });
        await transaction.user.deleteMany({ where: { id: { in: userIds } } });
      });
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
