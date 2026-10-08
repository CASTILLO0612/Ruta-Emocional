import type { ActiveRequest } from '../../models/ActiveRequest';
import {
  getRequestById,
  listenToPendingRequests,
  listenToRequest,
} from '../../repositories/RequestRepository';
import {
  clearActiveRequestId,
  loadActiveRequestId,
} from '../../services/persistence/activeRequestPersistence';
import { useRequestStore } from '../../store/useRequestStore';

jest.mock('expo-crypto', () => ({ randomUUID: () => 'deterministic-key' }));

jest.mock('../../repositories/RequestRepository', () => ({
  cancelRequest: jest.fn(),
  createRequest: jest.fn(),
  getRequestById: jest.fn(),
  listenToPendingRequests: jest.fn(() => jest.fn()),
  listenToRequest: jest.fn(() => jest.fn()),
}));

jest.mock('../../repositories/OfferRepository', () => ({
  acceptOffer: jest.fn(),
  listenToOffers: jest.fn(() => jest.fn()),
  submitOffer: jest.fn(),
}));

jest.mock('../../services/persistence/activeRequestPersistence', () => ({
  clearActiveRequestId: jest.fn(() => Promise.resolve()),
  loadActiveRequestId: jest.fn(() => Promise.resolve(null)),
  saveActiveRequestId: jest.fn(() => Promise.resolve()),
}));

const ACTIVE_REQUEST: ActiveRequest = {
  id: 'request-a',
  modality: 'chat',
  proposedBudget: 500,
  currencyCode: 'NIO',
  status: 'pending',
  expiresAt: new Date('2026-09-10T18:00:00.000Z'),
  createdAt: new Date('2026-09-10T17:00:00.000Z'),
};

const mockedLoadActiveRequestId = jest.mocked(loadActiveRequestId);
const mockedGetRequestById = jest.mocked(getRequestById);
const mockedClearActiveRequestId = jest.mocked(clearActiveRequestId);
const mockedListenToPendingRequests = jest.mocked(listenToPendingRequests);
const mockedListenToRequest = jest.mocked(listenToRequest);

describe('useRequestStore session isolation', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await useRequestStore.getState().clearSession();
  });

  it('elimina datos y suscripciones cuando cambia el usuario autenticado', () => {
    const requestUnsubscribe = jest.fn();
    const offerUnsubscribe = jest.fn();
    const pendingUnsubscribe = jest.fn();

    useRequestStore.getState().bindSession('patient-a');
    useRequestStore.setState({
      activeRequestId: ACTIVE_REQUEST.id,
      activeRequest: ACTIVE_REQUEST,
      incomingOffers: [
        {
          id: 'offer-a',
          requestId: ACTIVE_REQUEST.id,
          psychologistId: 'psychologist-a',
          psychologistName: 'Profesional A',
          psychologistRating: 5,
          amount: 500,
          currencyCode: 'NIO',
          status: 'pending',
          createdAt: new Date('2026-09-10T17:10:00.000Z'),
        },
      ],
      pendingRequests: [ACTIVE_REQUEST],
      _requestUnsub: requestUnsubscribe,
      _offersUnsub: offerUnsubscribe,
      _pendingUnsub: pendingUnsubscribe,
    });

    useRequestStore.getState().bindSession('patient-b');

    const state = useRequestStore.getState();
    expect(state.sessionUserId).toBe('patient-b');
    expect(state.activeRequest).toBeNull();
    expect(state.incomingOffers).toEqual([]);
    expect(state.pendingRequests).toEqual([]);
    expect(requestUnsubscribe).toHaveBeenCalledTimes(1);
    expect(offerUnsubscribe).toHaveBeenCalledTimes(1);
    expect(pendingUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('ignora una rehidratación anterior si la sesión cambia mientras está en curso', async () => {
    let resolveStoredId: ((value: string | null) => void) | undefined;
    mockedLoadActiveRequestId.mockImplementationOnce(
      () => new Promise((resolve) => { resolveStoredId = resolve; })
    );
    mockedGetRequestById.mockResolvedValue(ACTIVE_REQUEST);

    const rehydration = useRequestStore.getState().rehydrateActiveSearch('patient-a');
    useRequestStore.getState().bindSession('patient-b');
    resolveStoredId?.(ACTIVE_REQUEST.id);
    await rehydration;

    const state = useRequestStore.getState();
    expect(state.sessionUserId).toBe('patient-b');
    expect(state.activeRequest).toBeNull();
    expect(mockedGetRequestById).not.toHaveBeenCalled();
  });

  it('ignora resultados tardíos del directorio de solicitudes tras cambiar de sesión', () => {
    let deliverRequests: ((requests: ActiveRequest[]) => void) | undefined;
    mockedListenToPendingRequests.mockImplementationOnce((onRequests) => {
      deliverRequests = onRequests;
      return jest.fn();
    });

    useRequestStore.getState().bindSession('psychologist-a');
    useRequestStore.getState().startListeningToPendingRequests();
    expect(useRequestStore.getState().isPendingRequestsLoading).toBe(true);

    useRequestStore.getState().bindSession('psychologist-b');
    deliverRequests?.([ACTIVE_REQUEST]);

    expect(useRequestStore.getState().pendingRequests).toEqual([]);
    expect(useRequestStore.getState().isPendingRequestsLoading).toBe(false);
  });

  it('elimina la clave persistida del propietario al cerrar sesión', async () => {
    useRequestStore.getState().bindSession('patient-a');

    await useRequestStore.getState().clearSession('patient-a');

    expect(mockedClearActiveRequestId).toHaveBeenCalledWith('patient-a');
    expect(useRequestStore.getState().sessionUserId).toBeNull();
  });

  it('libera la búsqueda y su referencia persistida cuando deja de estar abierta', async () => {
    let deliverRequest: ((request: ActiveRequest) => void) | undefined;
    const unsubscribe = jest.fn();
    mockedListenToRequest.mockImplementationOnce((_requestId, onRequest) => {
      deliverRequest = onRequest;
      return unsubscribe;
    });

    useRequestStore.getState().bindSession('patient-a');
    useRequestStore.setState({
      activeRequestId: ACTIVE_REQUEST.id,
      activeRequest: ACTIVE_REQUEST,
      incomingOffers: [{
        id: 'offer-a',
        requestId: ACTIVE_REQUEST.id,
        psychologistId: 'psychologist-a',
        psychologistName: 'Profesional A',
        psychologistRating: 5,
        amount: 500,
        currencyCode: 'NIO',
        status: 'pending',
        createdAt: new Date('2026-09-10T17:10:00.000Z'),
      }],
    });
    useRequestStore.getState().startListeningToRequest(ACTIVE_REQUEST.id);

    deliverRequest?.({ ...ACTIVE_REQUEST, status: 'cancelled' });
    await Promise.resolve();

    expect(useRequestStore.getState().activeRequest).toBeNull();
    expect(useRequestStore.getState().activeRequestId).toBeNull();
    expect(useRequestStore.getState().incomingOffers).toEqual([]);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(mockedClearActiveRequestId).toHaveBeenCalledWith('patient-a');
  });
});
