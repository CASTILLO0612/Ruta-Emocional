import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';
import { ActiveRequest } from '../models/ActiveRequest';
import { Offer } from '../models/Offer';
import {
  cancelRequest,
  CreateRequestPayload,
  createRequest,
  getRequestById,
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
import { ApiError } from '../services/apiClient';
import { presentUserError } from '../utils/userFacingError';
import {
  saveActiveRequestId,
  loadActiveRequestId,
  clearActiveRequestId,
} from '../services/persistence/activeRequestPersistence';

interface RequestState {
  sessionUserId: string | null;
  activeRequestId: string | null;
  activeRequest: ActiveRequest | null;
  incomingOffers: Offer[];
  isSearching: boolean;
  isRehydratingActiveSearch: boolean;
  pendingRequests: ActiveRequest[];
  isPendingRequestsLoading: boolean;
  isLoading: boolean;
  error: string | null;
  _requestUnsub: (() => void) | null;
  _offersUnsub: (() => void) | null;
  _pendingUnsub: (() => void) | null;
  bindSession: (userId: string) => void;
  clearSession: (userId?: string) => Promise<void>;
  rehydrateActiveSearch: (userId: string) => Promise<void>;
  createSessionRequest: (params: CreateRequestPayload, userId: string) => Promise<ActiveRequest>;
  startListeningToRequest: (requestId: string) => void;
  startListeningToOffers: (requestId: string) => void;
  startListeningToPendingRequests: () => void;
  submitCounterOffer: (params: SubmitOfferPayload) => Promise<Offer>;
  acceptIncomingOffer: (offerId: string, userId: string) => Promise<AcceptedOfferResult>;
  cancelSearch: (userId: string) => Promise<void>;
  clearCurrentRequest: (userId: string) => Promise<void>;
  stopListeningToPendingRequests: () => void;
  clearError: () => void;
}

interface IdempotentAttempt {
  readonly fingerprint: string;
  readonly idempotencyKey: string;
}

interface PendingCreateAttempt extends IdempotentAttempt {
  readonly userId: string;
}

let pendingCreateAttempt: PendingCreateAttempt | null = null;
const acceptanceKeys = new Map<string, string>();
const pendingOfferAttempts = new Map<string, IdempotentAttempt>();
let sessionGeneration = 0;

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
  return presentUserError(
    error,
    'No pudimos completar la acción en este momento. Inténtalo nuevamente.'
  );
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
      isRehydratingActiveSearch: false,
      isLoading: false,
      error: null,
      _requestUnsub: null,
      _offersUnsub: null,
    });
  };

  const clearAllSubscriptions = () => {
    clearRequestSubscriptions();
    get()._pendingUnsub?.();
  };

  const resetInMemorySession = (nextUserId: string | null) => {
    sessionGeneration += 1;
    clearAllSubscriptions();
    pendingCreateAttempt = null;
    acceptanceKeys.clear();
    pendingOfferAttempts.clear();
    set({
      sessionUserId: nextUserId,
      activeRequestId: null,
      activeRequest: null,
      incomingOffers: [],
      isSearching: false,
      isRehydratingActiveSearch: false,
      pendingRequests: [],
      isPendingRequestsLoading: false,
      isLoading: false,
      error: null,
      _requestUnsub: null,
      _offersUnsub: null,
      _pendingUnsub: null,
    });
  };

  const clearPersistedRequest = async (userId?: string) => {
    if (!userId) return;
    try {
      await clearActiveRequestId(userId);
    } catch {
      // La memoria se limpia siempre, incluso si el almacenamiento seguro no responde.
    }
  };

  return {
    sessionUserId: null,
    activeRequestId: null,
    activeRequest: null,
    incomingOffers: [],
    isSearching: false,
    isRehydratingActiveSearch: false,
    pendingRequests: [],
    isPendingRequestsLoading: false,
    isLoading: false,
    error: null,
    _requestUnsub: null,
    _offersUnsub: null,
    _pendingUnsub: null,

    bindSession: (userId) => {
      if (get().sessionUserId !== userId) {
        resetInMemorySession(userId);
      }
    },

    clearSession: async (userId) => {
      const ownerId = userId ?? get().sessionUserId ?? undefined;
      resetInMemorySession(null);
      await clearPersistedRequest(ownerId);
    },

    rehydrateActiveSearch: async (userId: string) => {
      if (get().sessionUserId !== userId) {
        resetInMemorySession(userId);
      }
      if (get().isRehydratingActiveSearch || get().activeRequest) {
        return;
      }

      const generation = sessionGeneration;
      set({ isRehydratingActiveSearch: true, error: null });

      try {
        const savedId = await loadActiveRequestId(userId);
        if (generation !== sessionGeneration || get().sessionUserId !== userId) return;
        if (!savedId) {
          set({ isRehydratingActiveSearch: false });
          return;
        }

        const request = await getRequestById(savedId);
        if (generation !== sessionGeneration || get().sessionUserId !== userId) return;

        if (request.status === 'pending' || request.status === 'bidding') {
          set({
            activeRequestId: request.id,
            activeRequest: request,
            isSearching: true,
            isRehydratingActiveSearch: false,
          });
          get().startListeningToRequest(request.id);
          get().startListeningToOffers(request.id);
        } else {
          // Terminal status: accepted, in_session, completed, cancelled, expired
          await clearPersistedRequest(userId);
          clearRequestState();
          set({ isRehydratingActiveSearch: false });
        }
      } catch (error) {
        if (generation !== sessionGeneration || get().sessionUserId !== userId) return;
        if (
          error instanceof ApiError &&
          (error.status === 404 || error.status === 401 || error.status === 403)
        ) {
          // Terminal error: request does not exist or unauthorized
          await clearPersistedRequest(userId);
          clearRequestState();
        } else {
          // Recoverable error (offline, timeout, 5xx): keep ID, set error message
          set({ error: errorMessage(error) });
        }
        set({ isRehydratingActiveSearch: false });
      }
    },

    createSessionRequest: async (params, userId) => {
      if (get().sessionUserId !== userId) {
        resetInMemorySession(userId);
      }
      set({ isLoading: true, error: null });
      const fingerprint = createPayloadFingerprint(params);
      if (
        !pendingCreateAttempt
        || pendingCreateAttempt.userId !== userId
        || pendingCreateAttempt.fingerprint !== fingerprint
      ) {
        pendingCreateAttempt = { userId, fingerprint, idempotencyKey: randomUUID() };
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
        try {
          await saveActiveRequestId(userId, request.id);
        } catch {
          // La solicitud ya existe en servidor y permanece disponible en memoria.
        }
        get().startListeningToRequest(request.id);
        get().startListeningToOffers(request.id);
        return request;
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    startListeningToRequest: (requestId) => {
      get()._requestUnsub?.();
      const generation = sessionGeneration;
      const unsubscribe = listenToRequest(
        requestId,
        (request) => {
          if (generation === sessionGeneration) set({ activeRequest: request });
        },
        (error) => {
          if (generation === sessionGeneration) set({ error: errorMessage(error) });
        }
      );
      set({ _requestUnsub: unsubscribe });
    },

    startListeningToOffers: (requestId) => {
      get()._offersUnsub?.();
      const generation = sessionGeneration;
      const unsubscribe = listenToOffers(
        requestId,
        (offers) => {
          if (generation === sessionGeneration) {
            set({ incomingOffers: offers.filter((offer) => offer.status === 'pending') });
          }
        },
        (error) => {
          if (generation === sessionGeneration) set({ error: errorMessage(error) });
        }
      );
      set({ _offersUnsub: unsubscribe });
    },

    startListeningToPendingRequests: () => {
      get()._pendingUnsub?.();
      const generation = sessionGeneration;
      set({ isPendingRequestsLoading: true });
      const unsubscribe = listenToPendingRequests(
        (requests) => {
          if (generation === sessionGeneration) {
            set({ pendingRequests: requests, isPendingRequestsLoading: false });
          }
        },
        (error) => {
          if (generation === sessionGeneration) {
            set({ error: errorMessage(error), isPendingRequestsLoading: false });
          }
        }
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
        set({ isLoading: false });
        throw error;
      }
    },

    acceptIncomingOffer: async (offerId, userId) => {
      if (get().sessionUserId !== userId) {
        throw new Error('La solicitud activa no pertenece a la sesión actual.');
      }
      const requestId = get().activeRequestId ?? get().activeRequest?.id;
      if (!requestId) throw new Error('No hay una solicitud activa para aceptar la oferta.');

      const operationKey = `${requestId}:${offerId}`;
      const idempotencyKey = acceptanceKeys.get(operationKey) ?? randomUUID();
      acceptanceKeys.set(operationKey, idempotencyKey);
      set({ isLoading: true, error: null });
      try {
        const result = await acceptOffer(requestId, offerId, idempotencyKey);
        acceptanceKeys.delete(operationKey);
        clearRequestState();
        await clearPersistedRequest(userId);
        return result;
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    cancelSearch: async (userId) => {
      if (get().sessionUserId !== userId) {
        resetInMemorySession(userId);
      }
      const requestId = get().activeRequestId ?? get().activeRequest?.id;
      if (!requestId) {
        clearRequestState();
        await clearPersistedRequest(userId);
        return;
      }

      set({ isLoading: true, error: null });
      try {
        await cancelRequest(requestId);
        clearRequestState();
        await clearPersistedRequest(userId);
        set({ isLoading: false });
      } catch (error) {
        set({ isLoading: false });
        throw error;
      }
    },

    clearCurrentRequest: async (userId) => {
      clearRequestState();
      await clearPersistedRequest(userId);
    },

    stopListeningToPendingRequests: () => {
      get()._pendingUnsub?.();
      set({ _pendingUnsub: null, isPendingRequestsLoading: false });
    },

    clearError: () => set({ error: null }),
  };
});
