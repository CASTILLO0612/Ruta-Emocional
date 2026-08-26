import { apiRequest } from '../services/apiClient';
import { getSocket, joinRoom, leaveRoom } from '../services/socketClient';
import { ActiveRequest, RequestStatus } from '../models/ActiveRequest';
import { Modality } from '../models/Psychologist';

export interface CreateRequestPayload {
  patientId: string;
  patientName: string;
  patientPhotoURL?: string;
  modality: Modality;
  proposedBudget: number;
  primaryNeed?: string;
  description?: string;
  coordinates?: { latitude: number; longitude: number };
}

export async function createRequest(
  payload: CreateRequestPayload
): Promise<string> {
  try {
    const newReq = await apiRequest<ActiveRequest>('/requests', 'POST', payload);
    const requestId = newReq.id || (newReq as any)._id;

    // Emitir evento por socket para notificar a psicólogos en tiempo real
    const socket = getSocket();
    socket.emit('new_request_created', { ...newReq, id: requestId });

    return requestId;
  } catch (error) {
    throw new Error(`Error al crear la solicitud: ${error}`);
  }
}

export async function getActiveRequests(): Promise<ActiveRequest[]> {
  try {
    const list = await apiRequest<any[]>('/requests/active', 'GET');
    return list.map((item) => ({
      ...item,
      id: item._id || item.id,
    }));
  } catch (error) {
    throw new Error(`Error al obtener solicitudes activas: ${error}`);
  }
}

export async function updateRequestStatus(
  requestId: string,
  status: RequestStatus,
  extra?: Partial<ActiveRequest>
): Promise<void> {
  try {
    await apiRequest(`/requests/${requestId}/status`, 'PATCH', {
      status,
      ...extra,
    });

    // Notificar cambio de estado por socket
    const socket = getSocket();
    socket.emit('request_status_changed', { requestId, status, ...extra });
  } catch (error) {
    throw new Error(`Error al actualizar la solicitud: ${error}`);
  }
}

/**
 * Escucha solicitudes pendientes en tiempo real vía WebSockets.
 * Hace un fetch inicial y luego reacciona a eventos del servidor.
 */
export function listenToPendingRequests(
  callback: (requests: ActiveRequest[]) => void
): () => void {
  const socket = getSocket();
  let localRequests: ActiveRequest[] = [];

  // Fetch inicial para tener estado base
  const initialFetch = async () => {
    try {
      const requests = await getActiveRequests();
      localRequests = requests;
      callback(requests);
    } catch (err) {
      console.warn('[RequestRepository] Error en fetch inicial:', err);
    }
  };

  initialFetch();

  // Escuchar nuevas solicitudes broadcast
  const onNewRequest = (data: any) => {
    const newReq: ActiveRequest = {
      ...data,
      id: data._id || data.id,
    };
    // Evitar duplicados
    if (!localRequests.find((r) => r.id === newReq.id)) {
      localRequests = [newReq, ...localRequests];
      callback([...localRequests]);
    }
  };

  // Escuchar actualizaciones de solicitudes
  const onRequestUpdate = (data: any) => {
    if (!data?.requestId) return;
    localRequests = localRequests.map((r) =>
      r.id === data.requestId ? { ...r, ...data, id: data.requestId } : r
    );
    // Filtrar solo las que siguen pending/bidding
    const filtered = localRequests.filter(
      (r) => r.status === 'pending' || r.status === 'bidding'
    );
    localRequests = filtered;
    callback([...filtered]);
  };

  socket.on('broadcast_new_request', onNewRequest);
  socket.on('broadcast_request_update', onRequestUpdate);

  return () => {
    socket.off('broadcast_new_request', onNewRequest);
    socket.off('broadcast_request_update', onRequestUpdate);
  };
}

/**
 * Escucha una solicitud específica en tiempo real vía WebSockets.
 * Se une a la sala de la solicitud y escucha actualizaciones dirigidas.
 */
export function listenToRequest(
  requestId: string,
  callback: (request: ActiveRequest | null) => void
): () => void {
  const socket = getSocket();

  // Unirse a la sala de esta solicitud
  joinRoom(requestId);

  // Fetch inicial
  const initialFetch = async () => {
    try {
      const list = await getActiveRequests();
      const match = list.find((r) => r.id === requestId);
      callback(match || null);
    } catch (err) {
      console.warn('[RequestRepository] Error en fetch inicial de solicitud:', err);
    }
  };

  initialFetch();

  // Escuchar actualizaciones en la sala
  const onRequestUpdated = (data: any) => {
    if (data?.requestId === requestId || data?.id === requestId) {
      callback({ ...data, id: requestId } as ActiveRequest);
    }
  };

  // Escuchar actualizaciones globales también
  const onGlobalUpdate = (data: any) => {
    if (data?.requestId === requestId) {
      callback({ ...data, id: requestId } as ActiveRequest);
    }
  };

  socket.on('request_updated', onRequestUpdated);
  socket.on('broadcast_request_update', onGlobalUpdate);

  return () => {
    socket.off('request_updated', onRequestUpdated);
    socket.off('broadcast_request_update', onGlobalUpdate);
    leaveRoom(requestId);
  };
}
