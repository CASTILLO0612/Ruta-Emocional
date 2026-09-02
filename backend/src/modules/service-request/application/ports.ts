import { createHash } from 'crypto';
import {
  AcceptanceResult,
  CreateServiceRequestInput,
  EligibleServiceRequestView,
  PersistedServiceRequestInput,
  RequestPageQuery,
  ServiceOfferView,
  ServiceRequestPage,
  ServiceRequestView,
} from '../domain/serviceRequestTypes';

export interface RequestAuditContext {
  readonly actorUserId: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface IdempotentOperation {
  readonly key: string;
  readonly requestHash: string;
  readonly now: Date;
  readonly expiresAt: Date;
}

export interface ServiceRequestRepository {
  expireOpenRequests(now: Date, batchSize: number): Promise<number>;
  createRequest(
    userId: string,
    input: PersistedServiceRequestInput,
    idempotency: IdempotentOperation,
    maximumOpenImmediateRequests: number,
    audit: RequestAuditContext
  ): Promise<ServiceRequestView>;
  listOwnRequests(
    userId: string,
    query: RequestPageQuery
  ): Promise<ServiceRequestPage<ServiceRequestView>>;
  listEligibleRequests(
    userId: string,
    query: RequestPageQuery,
    now: Date
  ): Promise<ServiceRequestPage<EligibleServiceRequestView>>;
  findRequestForActor(userId: string, requestId: string): Promise<ServiceRequestView | null>;
  cancelOwnRequest(
    userId: string,
    requestId: string,
    audit: RequestAuditContext
  ): Promise<ServiceRequestView>;
  createOwnOffer(
    userId: string,
    requestId: string,
    amount: string,
    message: string | undefined,
    now: Date,
    idempotency: IdempotentOperation,
    audit: RequestAuditContext
  ): Promise<ServiceOfferView>;
  listRequestOffers(userId: string, requestId: string): Promise<readonly ServiceOfferView[]>;
  withdrawOwnOffer(
    userId: string,
    requestId: string,
    offerId: string,
    audit: RequestAuditContext
  ): Promise<ServiceOfferView>;
  acceptOffer(
    userId: string,
    requestId: string,
    offerId: string,
    idempotency: IdempotentOperation,
    audit: RequestAuditContext
  ): Promise<AcceptanceResult>;
}

export function hashRequestPayload(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input), 'utf8').digest('hex');
}
