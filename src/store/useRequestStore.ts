import { create } from 'zustand';
import { ActiveRequest } from '../models/ActiveRequest';
import { Offer } from '../models/Offer';
import { Modality } from '../models/Psychologist';
import {
  createRequest,
  listenToRequest,
  listenToPendingRequests,
} from '../repositories/RequestRepository';
import {
  submitOffer,
  acceptOffer,
  listenToOffers,
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

  createSessionRequest: (params: {
    patientId: string;
    patientName: string;
    patientPhotoURL?: string;
    modality: Modality;
    proposedBudget: number;
    primaryNeed?: string;
    description?: string;
  }) => Promise<void>;

  startListeningToRequest: (requestId: string) => void;
  startListeningToOffers: (requestId: string) => void;
  startListeningToPendingRequests: () => void;

  submitCounterOffer: (params: {
    requestId: string;
    psychologistId: string;
    psychologistName: string;
    psychologistPhotoURL?: string;
    psychologistRating: number;
    psychologistSpecialty: string;
    amount: number;
  }) => Promise<void>;

  acceptIncomingOffer: (
    offerId: string,
    psychologistId: string,
    finalPrice: number
  ) => Promise<void>;

  cancelSearch: () => void;
  clearError: () => void;
}

export const useRequestStore = create<RequestState>((set, get) => ({
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
    try {
      const requestId = await createRequest(params);
      set({ activeRequestId: requestId, isSearching: true, isLoading: false });

      get().startListeningToRequest(requestId);
      get().startListeningToOffers(requestId);
    } catch (error) {
      set({ error: `${error}`, isLoading: false });
    }
  },

  startListeningToRequest: (requestId) => {
    get()._requestUnsub?.();
    const unsub = listenToRequest(requestId, (request) => {
      set({ activeRequest: request });
    });
    set({ _requestUnsub: unsub });
  },

  startListeningToOffers: (requestId) => {
    get()._offersUnsub?.();
    const unsub = listenToOffers(requestId, (offers) => {
      set({ incomingOffers: offers });
    });
    set({ _offersUnsub: unsub });
  },

  startListeningToPendingRequests: () => {
    get()._pendingUnsub?.();
    const unsub = listenToPendingRequests((requests) => {
      set({ pendingRequests: requests });
    });
    set({ _pendingUnsub: unsub });
  },

  submitCounterOffer: async (params) => {
    set({ isLoading: true, error: null });
    try {
      await submitOffer(params);
      set({ isLoading: false });
    } catch (error) {
      set({ error: `${error}`, isLoading: false });
    }
  },

  acceptIncomingOffer: async (offerId, psychologistId, finalPrice) => {
    const requestId = get().activeRequestId;
    if (!requestId) return;
    set({ isLoading: true, error: null });
    try {
      await acceptOffer(requestId, offerId, psychologistId, finalPrice);
      set({ isSearching: false, isLoading: false });
    } catch (error) {
      set({ error: `${error}`, isLoading: false });
    }
  },

  cancelSearch: () => {
    get()._requestUnsub?.();
    get()._offersUnsub?.();
    set({
      activeRequestId: null,
      activeRequest: null,
      incomingOffers: [],
      isSearching: false,
      _requestUnsub: null,
      _offersUnsub: null,
    });
  },

  clearError: () => set({ error: null }),
}));
