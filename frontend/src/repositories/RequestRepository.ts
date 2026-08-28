import { getRequestPollingConfig } from '../config/runtimeConfig';
import { ActiveRequest, RequestStatus } from '../models/ActiveRequest';
import { Modality } from '../models/Psychologist';
import { apiV1Request } from '../services/apiClient';
import { createPollingSubscription } from '../services/pollingSubscription';

type ApiModality = 'CHAT' | 'CALL' | 'IN_PERSON';
type ApiRequestStatus =
  | 'PENDING'
  | 'BIDDING'
  | 'ACCEPTED'
  | 'IN_SESSION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'EXPIRED';

interface ApiMoney {
  readonly amount: string;
  readonly currency: string;
}

interface ApiRequestBase {
  readonly id: string;
  readonly modality: ApiModality;
  readonly primaryNeed: string | null;
  readonly description: string | null;
  readonly proposedBudget: ApiMoney;
  readonly status: ApiRequestStatus;
  readonly scheduledFor: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
}

interface ApiServiceRequest extends ApiRequestBase {
  readonly updatedAt: string;
  readonly acceptedOffer: {
    readonly id: string;
    readonly psychologistProfileId: string;
    readonly price: ApiMoney;
  } | null;
}

interface ApiEligibleServiceRequest extends ApiRequestBase {
  readonly status: 'PENDING' | 'BIDDING';
}

interface Envelope<T> {
  readonly data: T;
}

interface PageEnvelope<T> {
  readonly data: readonly T[];
  readonly meta: { readonly nextCursor: string | null };
}

export interface ServiceRequestPolicy {
  readonly minimumAmount: string;
  readonly maximumAmount: string;
  readonly supportedCurrencies: readonly [string, ...string[]];
  readonly immediateTtlMinutes: number;
  readonly scheduledLeadMinutes: number;
  readonly maximumScheduleDays: number;
  readonly maximumDescriptionLength: number;
  readonly maximumPrimaryNeedLength: number;
  readonly maximumOfferMessageLength: number;
}

export interface CreateRequestPayload {
  readonly modality: Modality;
  readonly proposedBudget: number;
  readonly currencyCode: string;
  readonly primaryNeed?: string;
  readonly description?: string;
  readonly scheduledFor?: Date;
  readonly location?: { readonly latitude: number; readonly longitude: number };
}

const MODALITY_TO_API: Record<Modality, ApiModality> = {
  chat: 'CHAT',
  call: 'CALL',
  'in-person': 'IN_PERSON',
};

const MODALITY_FROM_API: Record<ApiModality, Modality> = {
  CHAT: 'chat',
  CALL: 'call',
  IN_PERSON: 'in-person',
};

const STATUS_FROM_API: Record<ApiRequestStatus, RequestStatus> = {
  PENDING: 'pending',
  BIDDING: 'bidding',
  ACCEPTED: 'accepted',
  IN_SESSION: 'in-session',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
};

function toActiveRequest(request: ApiServiceRequest): ActiveRequest {
  return {
    id: request.id,
    modality: MODALITY_FROM_API[request.modality],
    ...(request.primaryNeed ? { primaryNeed: request.primaryNeed } : {}),
    ...(request.description ? { description: request.description } : {}),
    proposedBudget: Number(request.proposedBudget.amount),
    currencyCode: request.proposedBudget.currency,
    ...(request.acceptedOffer ? {
      acceptedOfferId: request.acceptedOffer.id,
      acceptedPsychologistId: request.acceptedOffer.psychologistProfileId,
    } : {}),
    status: STATUS_FROM_API[request.status],
    ...(request.scheduledFor ? { scheduledFor: new Date(request.scheduledFor) } : {}),
    expiresAt: new Date(request.expiresAt),
    createdAt: new Date(request.createdAt),
    updatedAt: new Date(request.updatedAt),
  };
}

function toEligibleActiveRequest(request: ApiEligibleServiceRequest): ActiveRequest {
  return {
    id: request.id,
    modality: MODALITY_FROM_API[request.modality],
    ...(request.primaryNeed ? { primaryNeed: request.primaryNeed } : {}),
    ...(request.description ? { description: request.description } : {}),
    proposedBudget: Number(request.proposedBudget.amount),
    currencyCode: request.proposedBudget.currency,
    status: STATUS_FROM_API[request.status],
    ...(request.scheduledFor ? { scheduledFor: new Date(request.scheduledFor) } : {}),
    expiresAt: new Date(request.expiresAt),
    createdAt: new Date(request.createdAt),
  };
}

export async function getServiceRequestPolicy(signal?: AbortSignal): Promise<ServiceRequestPolicy> {
  const response = await apiV1Request<Envelope<ServiceRequestPolicy>>(
    '/service-requests/policy',
    'GET',
    undefined,
    { signal }
  );
  return response.data;
}

export async function createRequest(
  payload: CreateRequestPayload,
  idempotencyKey: string,
  signal?: AbortSignal
): Promise<ActiveRequest> {
  const response = await apiV1Request<Envelope<ApiServiceRequest>>(
    '/service-requests',
    'POST',
    {
      modality: MODALITY_TO_API[payload.modality],
      proposedBudget: {
        amount: payload.proposedBudget.toFixed(2),
        currency: payload.currencyCode,
      },
      timing: payload.scheduledFor
        ? { kind: 'SCHEDULED', scheduledFor: payload.scheduledFor.toISOString() }
        : { kind: 'IMMEDIATE' },
      ...(payload.primaryNeed ? { primaryNeed: payload.primaryNeed } : {}),
      ...(payload.description ? { description: payload.description } : {}),
      ...(payload.location ? { location: payload.location } : {}),
    },
    { signal, idempotencyKey }
  );
  return toActiveRequest(response.data);
}

export async function getEligibleRequests(signal?: AbortSignal): Promise<ActiveRequest[]> {
  const response = await apiV1Request<PageEnvelope<ApiEligibleServiceRequest>>(
    '/service-requests/eligible',
    'GET',
    undefined,
    { signal }
  );
  return response.data.map(toEligibleActiveRequest);
}

export async function getRequestById(
  requestId: string,
  signal?: AbortSignal
): Promise<ActiveRequest> {
  const response = await apiV1Request<Envelope<ApiServiceRequest>>(
    `/service-requests/${encodeURIComponent(requestId)}`,
    'GET',
    undefined,
    { signal }
  );
  return toActiveRequest(response.data);
}

export async function cancelRequest(requestId: string): Promise<ActiveRequest> {
  const response = await apiV1Request<Envelope<ApiServiceRequest>>(
    `/service-requests/${encodeURIComponent(requestId)}/cancel`,
    'POST'
  );
  return toActiveRequest(response.data);
}

export function listenToPendingRequests(
  callback: (requests: ActiveRequest[]) => void,
  onError?: (error: unknown) => void
): () => void {
  return createPollingSubscription({
    intervalMs: getRequestPollingConfig().intervalMs,
    load: getEligibleRequests,
    onData: callback,
    onError,
  });
}

export function listenToRequest(
  requestId: string,
  callback: (request: ActiveRequest) => void,
  onError?: (error: unknown) => void
): () => void {
  return createPollingSubscription({
    intervalMs: getRequestPollingConfig().intervalMs,
    load: (signal) => getRequestById(requestId, signal),
    onData: callback,
    onError,
  });
}
