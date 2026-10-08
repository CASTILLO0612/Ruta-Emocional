export type CallMediaType = 'AUDIO' | 'VIDEO';
export type CallSessionStatus = 'RINGING' | 'ACTIVE' | 'ENDED' | 'DECLINED' | 'MISSED';

export interface CallParticipantView {
  readonly userId: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
}

export interface CallSessionView {
  readonly id: string;
  readonly conversationId: string;
  readonly initiatorUserId: string;
  readonly mediaType: CallMediaType;
  readonly status: CallSessionStatus;
  readonly initiator: CallParticipantView;
  readonly counterpart: CallParticipantView;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
  readonly expiresAt: string;
}

export interface CallSessionRecord extends CallSessionView {
  readonly roomName: string;
}

export interface CallAccessCredentials {
  readonly serverUrl: string;
  readonly accessToken: string;
}

export interface CallSessionResult {
  readonly call: CallSessionView;
  readonly credentials: CallAccessCredentials;
}
