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
import { MessageOutboxDispatcher } from '../../src/modules/messaging/infrastructure/outbox/messageOutboxDispatcher';
import { MessageView } from '../../src/modules/messaging/domain/messagingTypes';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

interface RegisteredActor {
  readonly userId: string;
  readonly accessToken: string;
}

interface AuthenticationResponse {
  readonly data: {
    readonly user: { readonly id: string };
    readonly tokens: { readonly accessToken: string };
  };
}

interface RequestResponse {
  readonly data: {
    readonly id: string;
    readonly proposedBudget: { readonly amount: string; readonly currency: string };
    readonly status: string;
  };
}

interface OfferResponse {
  readonly data: {
    readonly id: string;
    readonly requestId: string;
    readonly price: { readonly amount: string; readonly currency: string };
    readonly professional: { readonly profileId: string; readonly displayName: string };
  };
}

interface AcceptanceResponse {
  readonly data: {
    readonly request: { readonly id: string; readonly status: string };
    readonly acceptedOffer: OfferResponse['data'];
    readonly careRelationshipId: string;
    readonly conversationId: string;
    readonly replayed: boolean;
  };
}

async function readJson<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

function authenticatedHeaders(
  accessToken: string,
  idempotencyKey?: string
): Record<string, string> {
  return {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
  };
}

async function registerPatient(
  baseUrl: string,
  nonce: string,
  label: string
): Promise<RegisteredActor> {
  const response = await fetch(`${baseUrl}/auth/register/patient`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      displayName: `${label} Patient`,
      email: `${label.toLowerCase()}-patient-${nonce}@example.test`,
      password: `${label.toLowerCase()}-patient-integration-passphrase`,
    }),
  });
  assert.equal(response.status, 201);
  const body = await readJson<AuthenticationResponse>(response);
  return { userId: body.data.user.id, accessToken: body.data.tokens.accessToken };
}

async function registerPsychologist(
  baseUrl: string,
  nonce: string,
  label: string
): Promise<RegisteredActor> {
  const response = await fetch(`${baseUrl}/auth/register/psychologist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      displayName: `${label} Professional`,
      email: `${label.toLowerCase()}-professional-${nonce}@example.test`,
      password: `${label.toLowerCase()}-professional-integration-passphrase`,
      license: {
        authority: 'INTEGRATION-AUTHORITY',
        number: `${label}-${nonce}`,
      },
    }),
  });
  assert.equal(response.status, 201);
  const body = await readJson<AuthenticationResponse>(response);
  return { userId: body.data.user.id, accessToken: body.data.tokens.accessToken };
}

test('service request HTTP flow enforces ownership, eligibility, idempotency and one concurrent winner', {
  skip: !testDatabaseUrl,
}, async () => {
  const databaseUrl = testDatabaseUrl!;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const config = createTestConfig(databaseUrl, 'service-request-integration');
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
  const nonce = `${Date.now()}-${randomUUID()}`;
  const actors: RegisteredActor[] = [];
  const requestIds: string[] = [];

  try {
    const patient = await registerPatient(baseUrl, nonce, 'Owner');
    const otherPatient = await registerPatient(baseUrl, nonce, 'Other');
    const firstProfessional = await registerPsychologist(baseUrl, nonce, 'First');
    const secondProfessional = await registerPsychologist(baseUrl, nonce, 'Second');
    const pendingProfessional = await registerPsychologist(baseUrl, nonce, 'Pending');
    actors.push(patient, otherPatient, firstProfessional, secondProfessional, pendingProfessional);

    const verifiedProfiles = await prisma.psychologistProfile.findMany({
      where: { userId: { in: [firstProfessional.userId, secondProfessional.userId] } },
      select: { id: true },
    });
    assert.equal(verifiedProfiles.length, 2);
    await prisma.$transaction([
      prisma.psychologistProfile.updateMany({
        where: { id: { in: verifiedProfiles.map(({ id }) => id) } },
        data: { verificationStatus: VerificationStatus.VERIFIED },
      }),
      prisma.professionalLicense.updateMany({
        where: { psychologistProfileId: { in: verifiedProfiles.map(({ id }) => id) } },
        data: { status: VerificationStatus.VERIFIED, verifiedAt: new Date() },
      }),
      ...verifiedProfiles.map(({ id }) => prisma.psychologistModality.create({
        data: {
          psychologistProfileId: id,
          modality: Modality.CHAT,
          pricePerHour: '500.00',
          currencyCode: 'NIO',
          isEnabled: true,
        },
      })),
    ]);

    const pendingEligibility = await fetch(`${baseUrl}/service-requests/eligible`, {
      headers: authenticatedHeaders(pendingProfessional.accessToken),
    });
    assert.equal(pendingEligibility.status, 403);

    const creationKey = randomUUID();
    const creationBody = {
      modality: 'CHAT',
      primaryNeed: 'Acompañamiento emocional',
      description: 'Solicitud creada por la prueba HTTP de la fase de ofertas.',
      proposedBudget: { amount: '600.00', currency: 'NIO' },
      timing: { kind: 'IMMEDIATE' },
    };
    const creation = await fetch(`${baseUrl}/service-requests`, {
      method: 'POST',
      headers: authenticatedHeaders(patient.accessToken, creationKey),
      body: JSON.stringify(creationBody),
    });
    assert.equal(creation.status, 201);
    const createdRequest = await readJson<RequestResponse>(creation);
    requestIds.push(createdRequest.data.id);
    assert.equal(createdRequest.data.proposedBudget.amount, '600.00');

    const replay = await fetch(`${baseUrl}/service-requests`, {
      method: 'POST',
      headers: authenticatedHeaders(patient.accessToken, creationKey),
      body: JSON.stringify(creationBody),
    });
    assert.equal(replay.status, 201);
    assert.equal((await readJson<RequestResponse>(replay)).data.id, createdRequest.data.id);

    const changedReplay = await fetch(`${baseUrl}/service-requests`, {
      method: 'POST',
      headers: authenticatedHeaders(patient.accessToken, creationKey),
      body: JSON.stringify({
        ...creationBody,
        proposedBudget: { amount: '601.00', currency: 'NIO' },
      }),
    });
    assert.equal(changedReplay.status, 409);

    const forgedCreation = await fetch(`${baseUrl}/service-requests`, {
      method: 'POST',
      headers: authenticatedHeaders(patient.accessToken, randomUUID()),
      body: JSON.stringify({ ...creationBody, patientId: otherPatient.userId }),
    });
    assert.equal(forgedCreation.status, 422);

    const secondImmediate = await fetch(`${baseUrl}/service-requests`, {
      method: 'POST',
      headers: authenticatedHeaders(patient.accessToken, randomUUID()),
      body: JSON.stringify(creationBody),
    });
    assert.equal(secondImmediate.status, 409);

    const eligibleResponse = await fetch(`${baseUrl}/service-requests/eligible`, {
      headers: authenticatedHeaders(firstProfessional.accessToken),
    });
    assert.equal(eligibleResponse.status, 200);
    const eligible = await readJson<{ readonly data: readonly Record<string, unknown>[] }>(eligibleResponse);
    const visibleRequest = eligible.data.find(({ id }) => id === createdRequest.data.id);
    assert.ok(visibleRequest);
    assert.equal(visibleRequest.patientId, undefined);
    assert.equal(visibleRequest.patientName, undefined);
    assert.equal(visibleRequest.patient, undefined);

    const pendingOffer = await fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers`,
      {
        method: 'POST',
        headers: authenticatedHeaders(pendingProfessional.accessToken),
        body: JSON.stringify({ price: { amount: '300.00' } }),
      }
    );
    assert.equal(pendingOffer.status, 403);

    const forgedOffer = await fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers`,
      {
        method: 'POST',
        headers: authenticatedHeaders(firstProfessional.accessToken),
        body: JSON.stringify({ price: { amount: '400.00' }, psychologistId: verifiedProfiles[0].id }),
      }
    );
    assert.equal(forgedOffer.status, 422);

    const offerResponses: OfferResponse[] = [];
    const offerCreationKeys = [randomUUID(), randomUUID()];
    const offerInputs = [
      { professional: firstProfessional, amount: '400.00' },
      { professional: secondProfessional, amount: '450.00' },
    ];
    for (const [index, { professional, amount }] of offerInputs.entries()) {
      const response = await fetch(
        `${baseUrl}/service-requests/${createdRequest.data.id}/offers`,
        {
          method: 'POST',
          headers: authenticatedHeaders(professional.accessToken, offerCreationKeys[index]),
          body: JSON.stringify({ price: { amount } }),
        }
      );
      assert.equal(response.status, 201);
      offerResponses.push(await readJson<OfferResponse>(response));
    }
    const offerIds = offerResponses.map(({ data }) => data.id);

    const offerReplay = await fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers`,
      {
        method: 'POST',
        headers: authenticatedHeaders(firstProfessional.accessToken, offerCreationKeys[0]),
        body: JSON.stringify({ price: { amount: '400.00' } }),
      }
    );
    assert.equal(offerReplay.status, 201);
    assert.equal((await readJson<OfferResponse>(offerReplay)).data.id, offerIds[0]);

    const changedOfferReplay = await fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers`,
      {
        method: 'POST',
        headers: authenticatedHeaders(firstProfessional.accessToken, offerCreationKeys[0]),
        body: JSON.stringify({ price: { amount: '401.00' } }),
      }
    );
    assert.equal(changedOfferReplay.status, 409);

    const eligibleAfterOwnOffer = await readJson<{ readonly data: readonly { readonly id: string }[] }>(
      await fetch(`${baseUrl}/service-requests/eligible`, {
        headers: authenticatedHeaders(firstProfessional.accessToken, randomUUID()),
      })
    );
    assert.equal(
      eligibleAfterOwnOffer.data.some(({ id }) => id === createdRequest.data.id),
      false,
      'a request with an own offer is no longer actionable'
    );

    const duplicateOffer = await fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers`,
      {
        method: 'POST',
        headers: authenticatedHeaders(firstProfessional.accessToken, randomUUID()),
        body: JSON.stringify({ price: { amount: '475.00' } }),
      }
    );
    assert.equal(duplicateOffer.status, 409);

    const unauthorizedOffers = await fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers`,
      { headers: authenticatedHeaders(otherPatient.accessToken) }
    );
    assert.equal(unauthorizedOffers.status, 404);

    const manipulatedAcceptance = await fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers/${offerIds[0]}/accept`,
      {
        method: 'POST',
        headers: authenticatedHeaders(patient.accessToken, randomUUID()),
        body: JSON.stringify({ finalPrice: '1.00', psychologistId: pendingProfessional.userId }),
      }
    );
    assert.equal(manipulatedAcceptance.status, 422);

    const unauthorizedAcceptance = await fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers/${offerIds[0]}/accept`,
      {
        method: 'POST',
        headers: authenticatedHeaders(otherPatient.accessToken, randomUUID()),
      }
    );
    assert.equal(unauthorizedAcceptance.status, 404);

    const acceptanceKeys = [randomUUID(), randomUUID()];
    const concurrentAcceptances = await Promise.all(offerIds.map((offerId, index) => fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers/${offerId}/accept`,
      {
        method: 'POST',
        headers: authenticatedHeaders(patient.accessToken, acceptanceKeys[index]),
      }
    )));
    assert.deepEqual(concurrentAcceptances.map(({ status }) => status).sort(), [200, 409]);
    const winnerIndex = concurrentAcceptances.findIndex(({ status }) => status === 200);
    assert.notEqual(winnerIndex, -1);
    const winner = await readJson<AcceptanceResponse>(concurrentAcceptances[winnerIndex]);
    assert.equal(winner.data.request.status, 'ACCEPTED');
    assert.equal(winner.data.acceptedOffer.id, offerIds[winnerIndex]);
    assert.equal(
      winner.data.acceptedOffer.price.amount,
      offerResponses[winnerIndex].data.price.amount,
      'the accepted amount must come from the persisted offer'
    );
    assert.equal(winner.data.replayed, false);

    const acceptanceReplay = await fetch(
      `${baseUrl}/service-requests/${createdRequest.data.id}/offers/${offerIds[winnerIndex]}/accept`,
      {
        method: 'POST',
        headers: authenticatedHeaders(patient.accessToken, acceptanceKeys[winnerIndex]),
      }
    );
    assert.equal(acceptanceReplay.status, 200);
    const replayedAcceptance = await readJson<AcceptanceResponse>(acceptanceReplay);
    assert.equal(replayedAcceptance.data.replayed, true);
    assert.equal(replayedAcceptance.data.careRelationshipId, winner.data.careRelationshipId);
    assert.equal(replayedAcceptance.data.conversationId, winner.data.conversationId);

    const outsiderConversation = await fetch(
      `${baseUrl}/conversations/${winner.data.conversationId}`,
      { headers: authenticatedHeaders(otherPatient.accessToken) }
    );
    assert.equal(outsiderConversation.status, 404);

    const ownerConversations = await fetch(`${baseUrl}/conversations`, {
      headers: authenticatedHeaders(patient.accessToken),
    });
    assert.equal(ownerConversations.status, 200);
    const ownerConversationBody = await readJson<{
      readonly data: readonly { readonly id: string; readonly counterpart: { readonly userId: string } }[];
    }>(ownerConversations);
    const ownerConversation = ownerConversationBody.data.find(({ id }) => id === winner.data.conversationId);
    assert.ok(ownerConversation);
    assert.equal(ownerConversation.counterpart.userId, offerInputs[winnerIndex].professional.userId);

    const clientMessageId = randomUUID();
    const sendMessage = await fetch(
      `${baseUrl}/conversations/${winner.data.conversationId}/messages`,
      {
        method: 'POST',
        headers: authenticatedHeaders(patient.accessToken),
        body: JSON.stringify({
          clientMessageId,
          type: 'TEXT',
          text: 'Mensaje persistido antes de su entrega.',
        }),
      }
    );
    assert.equal(sendMessage.status, 201);
    const sent = await readJson<{
      readonly data: { readonly message: { readonly id: string }; readonly replayed: boolean };
    }>(sendMessage);
    assert.equal(sent.data.replayed, false);

    const messageReplay = await fetch(
      `${baseUrl}/conversations/${winner.data.conversationId}/messages`,
      {
        method: 'POST',
        headers: authenticatedHeaders(patient.accessToken),
        body: JSON.stringify({
          clientMessageId,
          type: 'TEXT',
          text: 'Mensaje persistido antes de su entrega.',
        }),
      }
    );
    assert.equal(messageReplay.status, 200);
    assert.equal((await readJson<typeof sent>(messageReplay)).data.message.id, sent.data.message.id);

    const changedMessageReplay = await fetch(
      `${baseUrl}/conversations/${winner.data.conversationId}/messages`,
      {
        method: 'POST',
        headers: authenticatedHeaders(patient.accessToken),
        body: JSON.stringify({ clientMessageId, type: 'TEXT', text: 'Contenido distinto.' }),
      }
    );
    assert.equal(changedMessageReplay.status, 409);

    const forgedMessage = await fetch(
      `${baseUrl}/conversations/${winner.data.conversationId}/messages`,
      {
        method: 'POST',
        headers: authenticatedHeaders(patient.accessToken),
        body: JSON.stringify({
          clientMessageId: randomUUID(),
          type: 'TEXT',
          text: 'Intento de suplantación.',
          senderId: otherPatient.userId,
        }),
      }
    );
    assert.equal(forgedMessage.status, 422);

    const professionalMessages = await fetch(
      `${baseUrl}/conversations/${winner.data.conversationId}/messages?limit=1`,
      { headers: authenticatedHeaders(offerInputs[winnerIndex].professional.accessToken) }
    );
    assert.equal(professionalMessages.status, 200);
    const messages = await readJson<{
      readonly data: readonly {
        readonly id: string;
        readonly sender: { readonly userId: string };
        readonly isOwn: boolean;
      }[];
    }>(professionalMessages);
    assert.equal(messages.data[0].sender.userId, patient.userId);
    assert.equal(messages.data[0].isOwn, false);

    const deliveredMessages: MessageView[] = [];
    const dispatcher = new MessageOutboxDispatcher(
      prisma,
      buildApplicationServices(config, prisma).messaging,
      {
        publishMessageCreated: async (message) => { deliveredMessages.push(message); },
        publishPsychologistVerificationUpdated: async () => undefined,
        publishAppointmentUpdated: async () => undefined,
        publishAppointmentReminder: async () => undefined,
      },
      createLogger('test'),
      config.messaging
    );
    assert.equal(await dispatcher.drainOnce(), 1);
    assert.equal(deliveredMessages[0].id, sent.data.message.id);
    assert.equal(await prisma.outboxEvent.count({
      where: { eventType: 'message.created', publishedAt: { not: null } },
    }), 1);

    const persistedOffers = await prisma.offer.findMany({
      where: { requestId: createdRequest.data.id },
      select: { id: true, status: true },
    });
    assert.equal(persistedOffers.filter(({ status }) => status === 'ACCEPTED').length, 1);
    assert.equal(persistedOffers.filter(({ status }) => status === 'PENDING').length, 0);
    assert.equal(await prisma.careRelationshipSource.count({
      where: { serviceRequestId: createdRequest.data.id },
    }), 1);
    assert.equal(await prisma.outboxEvent.count({
      where: { aggregateId: createdRequest.data.id, eventType: 'offer.accepted' },
    }), 1);
  } finally {
    const userIds = actors.map(({ userId }) => userId);
    if (userIds.length > 0) {
      await prisma.$transaction(async (transaction) => {
        const requests = await transaction.serviceRequest.findMany({
          where: { patientProfile: { userId: { in: userIds } } },
          select: { id: true },
        });
        const allRequestIds = requests.map(({ id }) => id);
        const conversationLinks = await transaction.requestConversation.findMany({
          where: { serviceRequestId: { in: allRequestIds } },
          select: { conversationId: true },
        });
        const conversationIds = conversationLinks.map(({ conversationId }) => conversationId);
        const participantIds = (await transaction.conversationParticipant.findMany({
          where: { conversationId: { in: conversationIds } },
          select: { id: true },
        })).map(({ id }) => id);
        await transaction.message.deleteMany({
          where: { conversationParticipantId: { in: participantIds } },
        });
        await transaction.outboxEvent.deleteMany({
          where: { aggregateId: { in: conversationIds } },
        });
        await transaction.conversation.deleteMany({ where: { id: { in: conversationIds } } });
        const sources = await transaction.careRelationshipSource.findMany({
          where: { serviceRequestId: { in: allRequestIds } },
          select: { careRelationshipId: true },
        });
        await transaction.careRelationshipSource.deleteMany({
          where: { serviceRequestId: { in: allRequestIds } },
        });
        await transaction.careRelationship.deleteMany({
          where: { id: { in: sources.map(({ careRelationshipId }) => careRelationshipId) } },
        });
        await transaction.offer.deleteMany({ where: { requestId: { in: allRequestIds } } });
        await transaction.outboxEvent.deleteMany({ where: { aggregateId: { in: allRequestIds } } });
        await transaction.serviceRequest.deleteMany({ where: { id: { in: allRequestIds } } });
        await transaction.idempotencyRecord.deleteMany({ where: { actorUserId: { in: userIds } } });
        await transaction.auditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
        const professionalProfiles = await transaction.psychologistProfile.findMany({
          where: { userId: { in: userIds } },
          select: { id: true },
        });
        const profileIds = professionalProfiles.map(({ id }) => id);
        await transaction.psychologistModality.deleteMany({
          where: { psychologistProfileId: { in: profileIds } },
        });
        await transaction.professionalLicense.deleteMany({
          where: { psychologistProfileId: { in: profileIds } },
        });
        await transaction.psychologistProfile.deleteMany({ where: { id: { in: profileIds } } });
        await transaction.patientProfile.deleteMany({ where: { userId: { in: userIds } } });
        await transaction.user.deleteMany({ where: { id: { in: userIds } } });
      });
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
});
