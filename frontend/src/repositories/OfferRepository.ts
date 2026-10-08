import { getRequestPollingConfig, resolveApiAssetUrl } from '../config/runtimeConfig';
import { Offer, OfferStatus } from '../models/Offer';
import type { Modality } from '../models/Psychologist';
import { apiV1Request } from '../services/apiClient';
import { createPollingSubscription } from '../services/pollingSubscription';

type ApiOfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';

interface ApiMoney {
  readonly amount: string;
  readonly currency: string;
}

interface ApiServiceOffer {
  readonly id: string;
  readonly requestId: string;
  readonly professional: {
    readonly profileId: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
    readonly primarySpecialty: string | null;
    readonly rating: number;
    readonly totalReviews: number;
  };
  readonly price: ApiMoney;
  readonly message: string | null;
  readonly status: ApiOfferStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface AcceptanceResponse {
  readonly request: { readonly id: string; readonly status: 'ACCEPTED' };
  readonly acceptedOffer: ApiServiceOffer;
  readonly careRelationshipId: string;
  readonly conversationId: string;
  readonly inPersonDestination: InPersonDestination | null;
  readonly replayed: boolean;
}

export interface InPersonDestination {
  readonly name: string;
  readonly address: string;
  readonly directions: string | null;
  readonly latitude: number;
  readonly longitude: number;
}

interface Envelope<T> {
  readonly data: T;
}

interface OwnOfferDto {
  readonly offer: ApiServiceOffer;
  readonly request: {
    readonly modality: 'CHAT' | 'CALL' | 'IN_PERSON';
    readonly primaryNeed: string | null;
    readonly proposedBudget: ApiMoney;
    readonly status: 'PENDING' | 'BIDDING' | 'ACCEPTED' | 'IN_SESSION' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
    readonly scheduledFor: string | null;
    readonly expiresAt: string;
  };
}

interface PageEnvelope<T> {
  readonly data: readonly T[];
  readonly meta: { readonly nextCursor: string | null };
}

export interface OwnOffer {
  readonly offer: Offer;
  readonly request: {
    readonly modality: Modality;
    readonly primaryNeed: string | null;
    readonly proposedBudget: number;
    readonly currencyCode: string;
    readonly status: OwnOfferDto['request']['status'];
    readonly scheduledFor: Date | null;
    readonly expiresAt: Date;
  };
}

export interface SubmitOfferPayload {
  readonly requestId: string;
  readonly amount: number;
  readonly message?: string;
}

export interface AcceptedOfferResult {
  readonly offer: Offer;
  readonly careRelationshipId: string;
  readonly conversationId: string;
  readonly inPersonDestination: InPersonDestination | null;
  readonly replayed: boolean;
}

const STATUS_FROM_API: Record<ApiOfferStatus, OfferStatus> = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
};

const MODALITY_FROM_API: Record<OwnOfferDto['request']['modality'], Modality> = {
  CHAT: 'chat',
  CALL: 'call',
  IN_PERSON: 'in-person',
};

function toOffer(offer: ApiServiceOffer): Offer {
  return {
    id: offer.id,
    requestId: offer.requestId,
    psychologistId: offer.professional.profileId,
    psychologistName: offer.professional.displayName,
    ...(offer.professional.photoUrl
      ? { psychologistPhotoURL: resolveApiAssetUrl(offer.professional.photoUrl) ?? undefined }
      : {}),
    psychologistRating: offer.professional.rating,
    ...(offer.professional.primarySpecialty
      ? { psychologistSpecialty: offer.professional.primarySpecialty }
      : {}),
    amount: Number(offer.price.amount),
    currencyCode: offer.price.currency,
    ...(offer.message ? { message: offer.message } : {}),
    status: STATUS_FROM_API[offer.status],
    createdAt: new Date(offer.createdAt),
  };
}

function toOwnOffer(item: OwnOfferDto): OwnOffer {
  return {
    offer: toOffer(item.offer),
    request: {
      modality: MODALITY_FROM_API[item.request.modality],
      primaryNeed: item.request.primaryNeed,
      proposedBudget: Number(item.request.proposedBudget.amount),
      currencyCode: item.request.proposedBudget.currency,
      status: item.request.status,
      scheduledFor: item.request.scheduledFor ? new Date(item.request.scheduledFor) : null,
      expiresAt: new Date(item.request.expiresAt),
    },
  };
}

export async function getOwnOffers(
  cursor?: string,
  signal?: AbortSignal
): Promise<{ readonly items: readonly OwnOffer[]; readonly nextCursor: string | null }> {
  const query = new URLSearchParams({ limit: '20' });
  if (cursor) query.set('cursor', cursor);
  const response = await apiV1Request<PageEnvelope<OwnOfferDto>>(
    `/offers/me?${query.toString()}`,
    'GET',
    undefined,
    { signal }
  );
  return { items: response.data.map(toOwnOffer), nextCursor: response.meta.nextCursor };
}

export async function withdrawOffer(requestId: string, offerId: string): Promise<Offer> {
  const response = await apiV1Request<Envelope<ApiServiceOffer>>(
    `/service-requests/${encodeURIComponent(requestId)}/offers/${encodeURIComponent(offerId)}/withdraw`,
    'POST'
  );
  return toOffer(response.data);
}

export async function submitOffer(
  payload: SubmitOfferPayload,
  idempotencyKey: string
): Promise<Offer> {
  const response = await apiV1Request<Envelope<ApiServiceOffer>>(
    `/service-requests/${encodeURIComponent(payload.requestId)}/offers`,
    'POST',
    {
      price: { amount: payload.amount.toFixed(2) },
      ...(payload.message?.trim() ? { message: payload.message.trim() } : {}),
    },
    { idempotencyKey }
  );
  return toOffer(response.data);
}

export async function getOffersForRequest(
  requestId: string,
  signal?: AbortSignal
): Promise<Offer[]> {
  const response = await apiV1Request<Envelope<readonly ApiServiceOffer[]>>(
    `/service-requests/${encodeURIComponent(requestId)}/offers`,
    'GET',
    undefined,
    { signal }
  );
  return response.data.map(toOffer);
}

export async function acceptOffer(
  requestId: string,
  offerId: string,
  idempotencyKey: string
): Promise<AcceptedOfferResult> {
  const response = await apiV1Request<Envelope<AcceptanceResponse>>(
    `/service-requests/${encodeURIComponent(requestId)}/offers/${encodeURIComponent(offerId)}/accept`,
    'POST',
    undefined,
    { idempotencyKey }
  );
  return {
    offer: toOffer(response.data.acceptedOffer),
    careRelationshipId: response.data.careRelationshipId,
    conversationId: response.data.conversationId,
    inPersonDestination: response.data.inPersonDestination,
    replayed: response.data.replayed,
  };
}

export function listenToOffers(
  requestId: string,
  callback: (offers: Offer[]) => void,
  onError?: (error: unknown) => void
): () => void {
  return createPollingSubscription({
    intervalMs: getRequestPollingConfig().intervalMs,
    load: (signal) => getOffersForRequest(requestId, signal),
    onData: callback,
    onError,
  });
}
