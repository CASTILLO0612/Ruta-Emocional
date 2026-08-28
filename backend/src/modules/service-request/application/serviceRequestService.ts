import { AppConfig } from '../../../config/env';
import { Clock } from '../../../shared/application/clock';
import { AppError } from '../../../shared/domain/appError';
import { AuthenticatedActor } from '../../identity/application/identityService';
import { hashRequestPayload, RequestAuditContext, ServiceRequestRepository } from './ports';
import {
  CreateServiceRequestInput,
  RequestPageQuery,
} from '../domain/serviceRequestTypes';

export class ServiceRequestService {
  constructor(
    private readonly repository: ServiceRequestRepository,
    private readonly clock: Clock,
    private readonly policy: AppConfig['requestFlow']
  ) {}

  getPolicy() {
    return {
      minimumAmount: this.policy.minimumAmount,
      maximumAmount: this.policy.maximumAmount,
      supportedCurrencies: this.policy.supportedCurrencies,
      immediateTtlMinutes: this.policy.immediateTtlMinutes,
      scheduledLeadMinutes: this.policy.scheduledLeadMinutes,
      maximumScheduleDays: this.policy.maximumScheduleDays,
      maximumDescriptionLength: this.policy.maximumDescriptionLength,
      maximumPrimaryNeedLength: this.policy.maximumPrimaryNeedLength,
      maximumOfferMessageLength: this.policy.maximumOfferMessageLength,
    };
  }

  async createRequest(
    actor: AuthenticatedActor,
    input: CreateServiceRequestInput,
    idempotencyKey: string,
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'service_request:create');
    const now = this.clock.now();
    const expiresAt = this.resolveOfferExpiration(input.scheduledFor, now);
    const locationExpiresAt = input.location
      ? new Date((input.scheduledFor ?? now).getTime() + this.policy.locationRetentionHours * 3_600_000)
      : undefined;

    return this.repository.createRequest(
      actor.user.id,
      { ...input, expiresAt, locationExpiresAt },
      {
        key: idempotencyKey,
        requestHash: hashRequestPayload(input),
        now,
        expiresAt: new Date(now.getTime() + this.policy.idempotencyTtlHours * 3_600_000),
      },
      this.policy.maximumOpenImmediateRequests,
      audit
    );
  }

  async listOwnRequests(actor: AuthenticatedActor, query: RequestPageQuery) {
    this.assertCapability(actor, 'service_request:manage:self');
    await this.repository.expireOpenRequests(this.clock.now(), this.policy.expirationBatchSize);
    return this.repository.listOwnRequests(actor.user.id, query);
  }

  async listEligibleRequests(actor: AuthenticatedActor, query: RequestPageQuery) {
    this.assertCapability(actor, 'service_request:read:eligible');
    const now = this.clock.now();
    await this.repository.expireOpenRequests(now, this.policy.expirationBatchSize);
    return this.repository.listEligibleRequests(actor.user.id, query, now);
  }

  async findRequest(actor: AuthenticatedActor, requestId: string) {
    if (!actor.user.capabilities.includes('service_request:manage:self')
      && !actor.user.capabilities.includes('service_request:read:eligible')) {
      throw AppError.forbidden('CAPABILITY_REQUIRED');
    }
    await this.repository.expireOpenRequests(this.clock.now(), this.policy.expirationBatchSize);
    const request = await this.repository.findRequestForActor(actor.user.id, requestId);
    if (!request) throw AppError.notFound('SERVICE_REQUEST_NOT_FOUND');
    return request;
  }

  cancelRequest(actor: AuthenticatedActor, requestId: string, audit: RequestAuditContext) {
    this.assertCapability(actor, 'service_request:manage:self');
    return this.repository.cancelOwnRequest(actor.user.id, requestId, audit);
  }

  async createOffer(
    actor: AuthenticatedActor,
    requestId: string,
    amount: string,
    message: string | undefined,
    idempotencyKey: string,
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'offer:create:self');
    const now = this.clock.now();
    await this.repository.expireOpenRequests(now, this.policy.expirationBatchSize);
    return this.repository.createOwnOffer(
      actor.user.id,
      requestId,
      amount,
      message,
      now,
      {
        key: idempotencyKey,
        requestHash: hashRequestPayload({ requestId, amount, message: message ?? null }),
        now,
        expiresAt: new Date(now.getTime() + this.policy.idempotencyTtlHours * 3_600_000),
      },
      audit
    );
  }

  listOffers(actor: AuthenticatedActor, requestId: string) {
    this.assertCapability(actor, 'service_request:manage:self');
    return this.repository.listRequestOffers(actor.user.id, requestId);
  }

  withdrawOffer(
    actor: AuthenticatedActor,
    requestId: string,
    offerId: string,
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'offer:manage:self');
    return this.repository.withdrawOwnOffer(actor.user.id, requestId, offerId, audit);
  }

  async acceptOffer(
    actor: AuthenticatedActor,
    requestId: string,
    offerId: string,
    idempotencyKey: string,
    audit: RequestAuditContext
  ) {
    this.assertCapability(actor, 'service_request:manage:self');
    const now = this.clock.now();
    await this.repository.expireOpenRequests(now, this.policy.expirationBatchSize);
    return this.repository.acceptOffer(
      actor.user.id,
      requestId,
      offerId,
      {
        key: idempotencyKey,
        requestHash: hashRequestPayload({ offerId }),
        now,
        expiresAt: new Date(now.getTime() + this.policy.idempotencyTtlHours * 3_600_000),
      },
      audit
    );
  }

  private resolveOfferExpiration(scheduledFor: Date | undefined, now: Date): Date {
    if (!scheduledFor) {
      return new Date(now.getTime() + this.policy.immediateTtlMinutes * 60_000);
    }

    const earliest = now.getTime() + this.policy.scheduledLeadMinutes * 60_000;
    const latest = now.getTime() + this.policy.maximumScheduleDays * 86_400_000;
    if (scheduledFor.getTime() < earliest || scheduledFor.getTime() > latest) {
      throw AppError.validation([{
        field: 'timing.scheduledFor',
        code: 'SCHEDULE_OUT_OF_RANGE',
        message: 'La fecha programada está fuera de la ventana permitida.',
      }]);
    }
    return new Date(
      scheduledFor.getTime() - this.policy.scheduledOfferCutoffMinutes * 60_000
    );
  }

  private assertCapability(actor: AuthenticatedActor, capability: string): void {
    if (!actor.user.capabilities.includes(capability)) {
      throw AppError.forbidden('CAPABILITY_REQUIRED');
    }
  }
}
