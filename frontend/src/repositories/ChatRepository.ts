import { apiRequest } from '../services/apiClient';
import { getSocket, joinRoom, leaveRoom } from '../services/socketClient';

export interface ChatMessage {
  _id?: string;
  id?: string;
  request: string;
  sender: string;
  senderName: string;
  senderRole: 'patient' | 'psychologist';
  text: string;
  type?: 'text' | 'image' | 'audio' | 'system';
  createdAt?: string | Date;
}

export async function fetchMessages(requestId: string): Promise<ChatMessage[]> {
  try {
    const list = await apiRequest<any[]>(`/chat/messages/${requestId}`, 'GET');
    return list.map((m) => ({
      ...m,
      id: m._id || m.id,
    }));
  } catch (error) {
    console.warn('[ChatRepository] Error al obtener mensajes:', error);
    return [];
  }
}

export async function sendChatMessage(payload: {
  requestId: string;
  senderId: string;
  senderName: string;
  senderRole: 'patient' | 'psychologist';
  text: string;
}): Promise<ChatMessage | null> {
  try {
    const newMsg = await apiRequest<any>('/chat/messages', 'POST', payload);
    const message: ChatMessage = {
      ...newMsg,
      id: newMsg._id || newMsg.id,
    };

    // Emitir mensaje por socket para entrega en tiempo real
    const socket = getSocket();
    socket.emit('send_message', {
      roomId: payload.requestId,
      message: {
        id: message.id,
        sender: payload.senderId,
        senderName: payload.senderName,
        senderRole: payload.senderRole,
        text: payload.text,
        type: 'text',
        createdAt: message.createdAt || new Date().toISOString(),
      },
    });

    return message;
  } catch (error) {
    console.warn('[ChatRepository] Error enviando mensaje:', error);
    return null;
  }
}

export async function fetchUserConversations(userId: string): Promise<any[]> {
  try {
    return await apiRequest<any[]>(`/chat/conversations/${userId}`, 'GET');
  } catch (error) {
    console.warn('[ChatRepository] Error al consultar conversaciones:', error);
    return [];
  }
}

/**
 * Escucha mensajes de chat en tiempo real vía WebSockets.
 * Hace un fetch inicial y luego escucha eventos `receive_message` en la sala.
 */
export function listenToChatMessages(
  requestId: string,
  callback: (messages: ChatMessage[]) => void
): () => void {
  const socket = getSocket();
  let localMessages: ChatMessage[] = [];

  // Unirse a la sala del chat
  joinRoom(requestId);

  // Fetch inicial
  const initialFetch = async () => {
    try {
      const msgs = await fetchMessages(requestId);
      localMessages = msgs;
      callback(msgs);
    } catch (err) {
      console.warn('[ChatRepository] Error en fetch inicial de mensajes:', err);
    }
  };

  initialFetch();

  // Escuchar nuevos mensajes en tiempo real
  const onNewMessage = (data: any) => {
    const newMsg: ChatMessage = {
      ...data,
      id: data._id || data.id || `temp-${Date.now()}`,
      request: requestId,
    };

    // Evitar duplicados por id
    if (newMsg.id && localMessages.find((m) => m.id === newMsg.id)) return;

    localMessages = [...localMessages, newMsg];
    callback([...localMessages]);
  };

  socket.on('receive_message', onNewMessage);

  return () => {
    socket.off('receive_message', onNewMessage);
    leaveRoom(requestId);
  };
}
