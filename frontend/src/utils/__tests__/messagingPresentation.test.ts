import type { ChatMessage } from '../../repositories/ChatRepository';
import {
  formatConversationActivity,
  formatMessageTime,
  getRealtimeConnectionLabel,
  mergeChatMessages,
} from '../messagingPresentation';

const message: ChatMessage = {
  id: 'message-1',
  conversationId: 'conversation-1',
  clientMessageId: 'client-1',
  type: 'TEXT',
  text: 'Hola',
  sentAt: '2099-09-03T16:00:00.000Z',
  sender: {
    userId: 'patient-1',
    displayName: 'María López',
    photoUrl: null,
    role: 'patient',
  },
  isOwn: false,
};

describe('messagingPresentation', () => {
  it('deduplica por remitente y clave cliente al confirmar un envío optimista', () => {
    const merged = mergeChatMessages([], [message, { ...message, id: 'message-server' }], 'patient-1');
    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(expect.objectContaining({ id: 'message-server', isOwn: true, delivery: 'sent' }));
  });

  it('expone el estado de conexión con texto y no solo color', () => {
    expect(getRealtimeConnectionLabel('connected')).toBe('En tiempo real');
    expect(getRealtimeConnectionLabel('connecting')).toBe('Conectando');
    expect(getRealtimeConnectionLabel('disconnected')).toBe('Sin conexión en tiempo real');
  });

  it('degrada fechas inválidas sin romper inbox o conversación', () => {
    expect(formatConversationActivity('invalida')).toBe('Sin fecha');
    expect(formatMessageTime('invalida')).toBe('Sin hora');
  });
});
