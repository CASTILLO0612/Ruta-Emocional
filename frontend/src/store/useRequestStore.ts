import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { ActiveRequest } from '../models/ActiveRequest';
import { Offer } from '../models/Offer';
import {
  cancelRequest,
  CreateRequestPayload,
  createRequest,
  listenToPendingRequests,
  listenToRequest,
} from '../repositories/RequestRepository';
import {
  AcceptedOfferResult,
  acceptOffer,
  listenToOffers,
  submitOffer,
  SubmitOfferPayload,
} from '../repositories/OfferRepository';

interface RequestState {
  activeRequestId: string | null;
  activeRequest: ActiveRequest | null;
  incomingOffers: Offer[];
  isSearching: boolean;
  pendingRequests: ActiveRequest[];
  isLoading: boolean;
  error: string | null;
  _requestUnsub: (() => void) | null;
  _offersUnsub: (() => void) | null;
  _pendingUnsub: (() => void) | null;
  createSessionRequest: (params: CreateRequestPayload) => Promise<ActiveRequest>;
  startListeningToRequest: (requestId: string) => void;
  startListeningToOffers: (requestId: string) => void;
  startListeningToPendingRequests: () => void;
  submitCounterOffer: (params: SubmitOfferPayload) => Promise<Offer>;
  acceptIncomingOffer: (offerId: string) => Promise<AcceptedOfferResult>;
  cancelSearch: () => Promise<void>;
  clearCurrentRequest: () => void;
  stopListeningToPendingRequests: () => void;
  clearError: () => void;
}

interface PendingCreateAttempt {
  readonly fingerprint: string;
  readonly idempotencyKey: string;
}

let pendingCreateAttempt: PendingCreateAttempt | null = null;
const acceptanceKeys = new Map<string, string>();
const pendingOfferAttempts = new Map<string, PendingCreateAttempt>();

function createPayloadFingerprint(payload: CreateRequestPayload): string {
  return JSON.stringify({
    modality: payload.modality,
    proposedBudget: payload.proposedBudget,
    currencyCode: payload.currencyCode,
    primaryNeed: payload.primaryNeed?.trim() ?? null,
    description: payload.description?.trim() ?? null,
    scheduledFor: payload.scheduledFor?.toISOString() ?? null,
    location: payload.location ?? null,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No pudimos completar la operación.';
}

export const useRequestStore = create<RequestState>((set, get) => {
  const clearRequestSubscriptions = () => {
    get()._requestUnsub?.();
    get()._offersUnsub?.();
  };

  const clearRequestState = () => {
    clearRequestSubscriptions();
    set({
      activeRequestId: null,
      activeRequest: null,
      incomingOffers: [],
      isSearching: false,
      _requestUnsub: null,
      _offersUnsub: null,
    });
  };

  return {
    activeRequestId: null,
    activeRequest: null,
    incomingOffers: [],
    isSearching: false,
    pendingRequests: [],
    isLoading: false,
    error: null,
    _requestUnsub: null,
    _offersUnsub: null,
    _pendingUnsub: null,

    createSessionRequest: async (params) => {
      set({ isLoading: true, error: null });
      const fingerprint = createPayloadFingerprint(params);
      if (!pendingCreateAttempt || pendingCreateAttempt.fingerprint !== fingerprint) {
        pendingCreateAttempt = { fingerprint, idempotencyKey: randomUUID() };
      }

      try {
        const request = await createRequest(params, pendingCreateAttempt.idempotencyKey);
        pendingCreateAttempt = null;
        set({
          activeRequestId: request.id,
          activeRequest: request,
          incomingOffers: [],
          isSearching: true,
          isLoading: false,
        });
        get().startListeningToRequest(request.id);
        get().startListeningToOffers(request.id);
        return request;
      } catch (error) {
        set({ error: errorMessage(error), isLoading: false });
        throw error;
      }
    },

    startListeningToRequest: (requestId) => {
      get()._requestUnsub?.();
      const unsubscribe = listenToRequest(
        requestId,
        (request) => set({ activeRequest: request }),
        (error) => set({ error: errorMessage(error) })
      );
      set({ _requestUnsub: unsubscribe });
    },

    startListeningToOffers: (requestId) => {
      get()._offersUnsub?.();
      const unsubscribe = listenToOffers(
        requestId,
        (offers) => set({ incomingOffers: offers.filter((offer) => offer.status === 'pending') }),
        (error) => set({ error: errorMessage(error) })
      );
      set({ _offersUnsub: unsubscribe });
    },

    startListeningToPendingRequests: () => {
      get()._pendingUnsub?.();
      const unsubscribe = listenToPendingRequests(
        (requests) => set({ pendingRequests: requests }),
        (error) => set({ error: errorMessage(error) })
      );
      set({ _pendingUnsub: unsubscribe });
    },

    submitCounterOffer: async (params) => {
      set({ isLoading: true, error: null });
      const fingerprint = JSON.stringify({
        amount: params.amount.toFixed(2),
        message: params.message?.trim() ?? null,
      });
      const currentAttempt = pendingOfferAttempts.get(params.requestId);
      const attempt = currentAttempt?.fingerprint === fingerprint
        ? currentAttempt
        : { fingerprint, idempotencyKey: randomUUID() };
      pendingOfferAttempts.set(params.requestId, attempt);
      try {
        const offer = await submitOffer(params, attempt.idempotencyKey);
        pendingOfferAttempts.delete(params.requestId);
        set((state) => ({
          pendingRequests: state.pendingRequests.filter(({ id }) => id !== params.requestId),
          isLoading: false,
        }));
        return offer;
      } catch (error) {
        set({ error: errorMessage(error), isLoading: false });
        throw error;
      }
    },

    acceptIncomingOffer: async (offerId) => {
      const requestId = get().activeRequestId ?? get().activeRequest?.id;
      if (!requestId) throw new Error('No hay una solicitud activa para aceptar la oferta.');

      const operationKey = `${requestId}:${offerId}`;
      const idempotencyKey = acceptanceKeys.get(operationKey) ?? randomUUID();
      acceptanceKeys.set(operationKey, idempotencyKey);
      set({ isLoading: true, error: null });
      try {
        const result = await acceptOffer(requestId, offerId, idempotencyKey);
        set((state) => ({
          incomingOffers: state.incomingOffers.map((offer) => ({
            ...offer,
            status: offer.id === offerId ? 'accepted' : 'rejected',
          })),
          isSearching: false,
          isLoading: false,
        }));
        return result;
      } catch (error) {
        set({ error: errorMessage(error), isLoading: false });
        throw error;
      }
    },

    cancelSearch: async () => {
      const requestId = get().activeRequestId ?? get().activeRequest?.id;
      if (!requestId) {
        clearRequestState();
        return;
      }

      set({ isLoading: true, error: null });
      try {
        await cancelRequest(requestId);
        clearRequestState();
        set({ isLoading: false });
      } catch (error) {
        set({ error: errorMessage(error), isLoading: false });
        throw error;
      }
    },

    clearCurrentRequest: clearRequestState,

    stopListeningToPendingRequests: () => {
      get()._pendingUnsub?.();
      set({ _pendingUnsub: null });
    },

    clearError: () => set({ error: null }),
  };
});
