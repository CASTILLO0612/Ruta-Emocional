import { apiRequest } from '../services/apiClient';
import { getSocket, joinRoom, leaveRoom } from '../services/socketClient';
import { Offer } from '../models/Offer';

export interface SubmitOfferPayload {
  requestId: string;
  psychologistId: string;
  psychologistName: string;
  psychologistPhotoURL?: string;
  psychologistRating: number;
  psychologistSpecialty: string;
  amount: number;
}

export async function submitOffer(payload: SubmitOfferPayload): Promise<string> {
  try {
    const newOffer = await apiRequest<any>('/offers', 'POST', payload);
    const offerId = newOffer.id || newOffer._id;

    // Emitir evento por socket para notificar al paciente en tiempo real
    const socket = getSocket();
    socket.emit('new_offer_created', {
      ...newOffer,
      id: offerId,
      requestId: payload.requestId,
    });

    return offerId;
  } catch (error) {
    throw new Error(`Error enviando la oferta: ${error}`);
  }
}

export async function getOffersForRequest(requestId: string): Promise<Offer[]> {
  try {
    const list = await apiRequest<any[]>(`/offers/request/${requestId}`, 'GET');
    return list.map((item) => ({
      ...item,
      id: item._id || item.id,
      requestId: item.request || item.requestId,
      psychologistId: item.psychologist || item.psychologistId,
    }));
  } catch (error) {
    throw new Error(`Error obteniendo ofertas: ${error}`);
  }
}

export async function acceptOffer(
  requestId: string,
  offerId: string,
  psychologistId: string,
  finalPrice: number,
  modality?: string,
  patientName?: string
): Promise<void> {
  try {
    await apiRequest('/offers/accept', 'POST', {
      offerId,
      requestId,
      psychologistId,
      finalPrice,
    });

    // Notificar aceptación por socket
    const socket = getSocket();
    socket.emit('offer_accepted', {
      requestId,
      offerId,
      psychologistId,
      finalPrice,
      modality,
      patientName,
    });
  } catch (error) {
    throw new Error(`Error aceptando oferta: ${error}`);
  }
}

/**
 * Escucha ofertas para una solicitud en tiempo real vía WebSockets.
 * Hace un fetch inicial y luego reacciona a eventos del servidor.
 */
export function listenToOffers(
  requestId: string,
  callback: (offers: Offer[]) => void
): () => void {
  const socket = getSocket();
  let localOffers: Offer[] = [];

  // Asegurar que estamos en la sala de esta solicitud
  joinRoom(requestId);

  // Fetch inicial
  const initialFetch = async () => {
    try {
      const offers = await getOffersForRequest(requestId);
      localOffers = offers;
      callback(offers);
    } catch (err) {
      console.warn('[OfferRepository] Error en fetch inicial de ofertas:', err);
    }
  };

  initialFetch();

  // Escuchar nuevas ofertas en la sala de la solicitud o vía broadcast global
  const onNewOffer = (data: any) => {
    const incomingRequestId = data.requestId || data.request;
    if (String(incomingRequestId) !== String(requestId)) return;

    const newOffer: Offer = {
      ...data,
      id: data._id || data.id,
      requestId: String(incomingRequestId),
      psychologistId: String(data.psychologist || data.psychologistId),
    };

    // Evitar duplicados
    if (!localOffers.find((o) => String(o.id) === String(newOffer.id))) {
      localOffers = [newOffer, ...localOffers];
      callback([...localOffers]);
    }
  };

  // Escuchar cuando una oferta es aceptada (para actualizar estados)
  const onOfferAccepted = (data: any) => {
    if (String(data?.requestId) !== String(requestId)) return;
    localOffers = localOffers.map((o) => ({
      ...o,
      status: String(o.id) === String(data.offerId) ? 'accepted' : 'rejected',
    }));
    callback([...localOffers]);
  };

  socket.on('receive_new_offer', onNewOffer);
  socket.on('receive_new_offer_broadcast', onNewOffer);
  socket.on('offer_was_accepted', onOfferAccepted);

  return () => {
    socket.off('receive_new_offer', onNewOffer);
    socket.off('receive_new_offer_broadcast', onNewOffer);
    socket.off('offer_was_accepted', onOfferAccepted);
    leaveRoom(requestId);
  };
}
