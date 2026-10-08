import assert from 'node:assert/strict';
import test from 'node:test';
import type { AppConfig } from '../../src/config/env';
import type { AuthenticatedActor } from '../../src/modules/identity/application/identityService';
import type { CallAccessTokenIssuer, CallSessionRepository } from '../../src/modules/call/application/ports';
import type { CallSessionRecord } from '../../src/modules/call/domain/callTypes';
import { CallService } from '../../src/modules/call/application/callService';
import { AppError } from '../../src/shared/domain/appError';

const policy: AppConfig['calls'] = {
  enabled: true,
  liveKitUrl: 'wss://rtc.example.test',
  liveKitApiKey: 'public-key',
  liveKitApiSecret: 'server-only-secret',
  accessTokenTtlSeconds: 600,
  ringingTimeoutSeconds: 45,
  maximumDurationSeconds: 7_200,
  mutationsPerMinute: 12,
};

const callRecord: CallSessionRecord = {
  id: '37cb148e-675f-4e74-98bf-7961eb82693c',
  conversationId: '17f10ff0-d4de-4a75-9a4f-d1c3d6a2d0a8',
  initiatorUserId: '6c8291e5-8557-4d72-aa77-8325c61fb55c',
  mediaType: 'AUDIO',
  status: 'RINGING',
  initiator: {
    userId: '6c8291e5-8557-4d72-aa77-8325c61fb55c',
    displayName: 'Paciente',
    photoUrl: null,
  },
  counterpart: {
    userId: '9a76aaf8-13a2-4f49-bd38-6b0e21910994',
    displayName: 'Profesional',
    photoUrl: null,
  },
  roomName: 'opaque-room-id',
  createdAt: '2026-10-07T12:00:00.000Z',
  acceptedAt: null,
  expiresAt: '2026-10-07T12:00:45.000Z',
};

const actor: AuthenticatedActor = {
  user: {
    id: callRecord.initiatorUserId,
    email: 'patient@example.test',
    displayName: 'Paciente',
    photoUrl: null,
    status: 'ACTIVE',
    roles: ['patient'],
    psychologistVerificationStatus: null,
    capabilities: ['conversation:read:self'],
  },
  sessionId: 'session-id',
};

function repository(overrides: Partial<CallSessionRepository> = {}): CallSessionRepository {
  return {
    start: async () => callRecord,
    findForParticipant: async () => callRecord,
    join: async () => ({ ...callRecord, status: 'ACTIVE' }),
    finish: async () => ({ ...callRecord, status: 'ENDED' }),
    ...overrides,
  };
}

test('starting a call returns a short-lived room token and never exposes the room name', async () => {
  let issued: Parameters<CallAccessTokenIssuer['issue']>[0] | undefined;
  const issuer: CallAccessTokenIssuer = {
    issue: async (input) => {
      issued = input;
      return { serverUrl: 'wss://rtc.example.test', accessToken: 'ephemeral-token' };
    },
  };
  const service = new CallService(repository(), issuer, policy);

  const result = await service.start(actor, callRecord.conversationId, 'AUDIO', {
    actorUserId: actor.user.id,
  });

  assert.equal(result.call.status, 'RINGING');
  assert.equal(result.credentials.accessToken, 'ephemeral-token');
  assert.equal('roomName' in result.call, false);
  assert.equal(issued?.roomName, callRecord.roomName);
  assert.equal(issued?.ttlSeconds, policy.accessTokenTtlSeconds);
});

test('call operations reject actors without conversation access before touching the repository', async () => {
  let repositoryCalled = false;
  const service = new CallService(repository({
    start: async () => {
      repositoryCalled = true;
      return callRecord;
    },
  }), { issue: async () => ({ serverUrl: 'wss://rtc.example.test', accessToken: 'token' }) }, policy);
  const unauthorized = {
    ...actor,
    user: { ...actor.user, capabilities: [] },
  };

  await assert.rejects(
    service.start(unauthorized, callRecord.conversationId, 'VIDEO', { actorUserId: actor.user.id }),
    (error: unknown) => error instanceof AppError && error.status === 403
  );
  assert.equal(repositoryCalled, false);
});

test('disabled RTC provider fails closed with a safe service error', async () => {
  const disabled = new CallService(repository(), null, { ...policy, enabled: false });
  await assert.rejects(
    disabled.start(actor, callRecord.conversationId, 'AUDIO', { actorUserId: actor.user.id }),
    (error: unknown) => error instanceof AppError && error.status === 503 && error.code === 'CALLING_UNAVAILABLE'
  );
});

test('joining an incoming call issues a participant-specific token', async () => {
  let issuedIdentity = '';
  let maximumDuration = 0;
  const recipient = {
    ...actor,
    user: { ...actor.user, id: callRecord.counterpart.userId, displayName: callRecord.counterpart.displayName },
  };
  const service = new CallService(repository({
    join: async (_actorUserId, _callId, duration) => {
      maximumDuration = duration;
      return { ...callRecord, status: 'ACTIVE' };
    },
  }), {
    issue: async (input) => {
      issuedIdentity = input.identity;
      return { serverUrl: 'wss://rtc.example.test', accessToken: 'recipient-token' };
    },
  }, policy);

  const result = await service.join(recipient, callRecord.id, { actorUserId: recipient.user.id });
  assert.equal(issuedIdentity, recipient.user.id);
  assert.equal(result.call.status, 'ACTIVE');
  assert.equal(maximumDuration, policy.maximumDurationSeconds);
});
