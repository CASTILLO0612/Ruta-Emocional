import type { CallMediaType, CallSessionRecord } from '../domain/callTypes';

export interface CallAuditContext {
  readonly actorUserId: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface CallSessionRepository {
  start(
    actorUserId: string,
    conversationId: string,
    mediaType: CallMediaType,
    ringingTimeoutSeconds: number,
    audit: CallAuditContext
  ): Promise<CallSessionRecord>;
  findForParticipant(actorUserId: string, callId: string): Promise<CallSessionRecord>;
  join(
    actorUserId: string,
    callId: string,
    maximumDurationSeconds: number,
    audit: CallAuditContext
  ): Promise<CallSessionRecord>;
  finish(
    actorUserId: string,
    callId: string,
    outcome: 'ENDED' | 'DECLINED',
    audit: CallAuditContext
  ): Promise<CallSessionRecord>;
}

export interface CallAccessTokenIssuer {
  issue(input: {
    readonly roomName: string;
    readonly identity: string;
    readonly displayName: string;
    readonly ttlSeconds: number;
    readonly mediaType: CallMediaType;
  }): Promise<{ readonly serverUrl: string; readonly accessToken: string }>;
}
