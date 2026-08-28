import { getRequestPollingConfig } from '../config/runtimeConfig';
import { Offer, OfferStatus } from '../models/Offer';
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
  readonly replayed: boolean;
}

interface Envelope<T> {
  readonly data: T;
}

export interface SubmitOfferPayload {
  readonly requestId: string;
  readonly amount: number;
  readonly message?: string;
}

export interface AcceptedOfferResult {
  readonly offer: Offer;
  readonly careRelationshipId: string;
  readonly replayed: boolean;
}

const STATUS_FROM_API: Record<ApiOfferStatus, OfferStatus> = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
};

function toOffer(offer: ApiServiceOffer): Offer {
  return {
    id: offer.id,
    requestId: offer.requestId,
    psychologistId: offer.professional.profileId,
    psychologistName: offer.professional.displayName,
    ...(offer.professional.photoUrl ? { psychologistPhotoURL: offer.professional.photoUrl } : {}),
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
