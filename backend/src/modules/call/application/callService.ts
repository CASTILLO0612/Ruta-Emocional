import { AuthenticatedActor } from '../../identity/application/identityService';
import { AppError } from '../../../shared/domain/appError';
import type { CallAccessTokenIssuer, CallAuditContext, CallSessionRepository } from './ports';
import type { CallMediaType, CallSessionResult } from '../domain/callTypes';
import type { AppConfig } from '../../../config/env';

export class CallService {
  constructor(
    private readonly repository: CallSessionRepository,
    private readonly tokenIssuer: CallAccessTokenIssuer | null,
    private readonly policy: AppConfig['calls']
  ) {}

  async start(
    actor: AuthenticatedActor,
    conversationId: string,
    mediaType: CallMediaType,
    audit: CallAuditContext
  ): Promise<CallSessionResult> {
    this.assertEnabled();
    this.assertCapability(actor);
    const call = await this.repository.start(
      actor.user.id,
      conversationId,
      mediaType,
      this.policy.ringingTimeoutSeconds,
      audit
    );
    return {
      call: this.publicView(call),
      credentials: await this.issueToken(call, actor.user.id, actor.user.displayName),
    };
  }

  async join(actor: AuthenticatedActor, callId: string, audit: CallAuditContext): Promise<CallSessionResult> {
    this.assertEnabled();
    this.assertCapability(actor);
    const call = await this.repository.join(
      actor.user.id,
      callId,
      this.policy.maximumDurationSeconds,
      audit
    );
    return {
      call: this.publicView(call),
      credentials: await this.issueToken(call, actor.user.id, actor.user.displayName),
    };
  }

  async get(actor: AuthenticatedActor, callId: string) {
    this.assertCapability(actor);
    return this.publicView(await this.repository.findForParticipant(actor.user.id, callId));
  }

  async finish(
    actor: AuthenticatedActor,
    callId: string,
    outcome: 'ENDED' | 'DECLINED',
    audit: CallAuditContext
  ) {
    this.assertCapability(actor);
    return this.publicView(await this.repository.finish(actor.user.id, callId, outcome, audit));
  }

  private async issueToken(
    call: Awaited<ReturnType<CallSessionRepository['findForParticipant']>>,
    userId: string,
    displayName: string
  ) {
    if (!this.tokenIssuer) throw AppError.unavailable('CALLING_UNAVAILABLE', 'Las llamadas no están configuradas en este momento.');
    return this.tokenIssuer.issue({
      roomName: call.roomName,
      identity: userId,
      displayName,
      ttlSeconds: this.policy.accessTokenTtlSeconds,
      mediaType: call.mediaType,
    });
  }

  private publicView(call: Awaited<ReturnType<CallSessionRepository['findForParticipant']>>) {
    const { roomName: _roomName, ...view } = call;
    return view;
  }

  private assertEnabled(): void {
    if (!this.policy.enabled || !this.tokenIssuer) {
      throw AppError.unavailable('CALLING_UNAVAILABLE', 'Las llamadas no están configuradas en este momento.');
    }
  }

  private assertCapability(actor: AuthenticatedActor): void {
    if (!actor.user.capabilities.includes('conversation:read:self')) {
      throw AppError.forbidden('CAPABILITY_REQUIRED');
    }
  }
}
