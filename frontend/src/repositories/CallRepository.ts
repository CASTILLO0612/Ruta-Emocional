import { apiV1Request } from '../services/apiClient';

export type CallMediaType = 'AUDIO' | 'VIDEO';
export type CallStatus = 'RINGING' | 'ACTIVE' | 'ENDED' | 'DECLINED' | 'MISSED';

export interface CallParticipant {
  readonly userId: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
}

export interface CallSession {
  readonly id: string;
  readonly conversationId: string;
  readonly initiatorUserId: string;
  readonly mediaType: CallMediaType;
  readonly status: CallStatus;
  readonly initiator: CallParticipant;
  readonly counterpart: CallParticipant;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
  readonly expiresAt: string;
}

export interface CallConnection {
  readonly call: CallSession;
  readonly credentials: {
    readonly serverUrl: string;
    readonly accessToken: string;
  };
}

interface Envelope<T> { readonly data: T }

export async function startCall(
  conversationId: string,
  mediaType: CallMediaType
): Promise<CallConnection> {
  return (await apiV1Request<Envelope<CallConnection>>(
    `/conversations/${conversationId}/calls`,
    'POST',
    { mediaType }
  )).data;
}

export async function getCall(callId: string): Promise<CallSession> {
  return (await apiV1Request<Envelope<CallSession>>(`/calls/${callId}`)).data;
}

export async function joinCall(callId: string): Promise<CallConnection> {
  return (await apiV1Request<Envelope<CallConnection>>(`/calls/${callId}/join`, 'POST')).data;
}

export async function finishCall(callId: string): Promise<void> {
  await apiV1Request(`/calls/${callId}/end`, 'POST');
}

export async function declineCall(callId: string): Promise<void> {
  await apiV1Request(`/calls/${callId}/decline`, 'POST');
}
