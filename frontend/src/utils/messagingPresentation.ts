import { APP_LOCALE } from '../config/localization';
import type { ChatMessage, Conversation } from '../repositories/ChatRepository';
import type { RealtimeConnectionState } from '../services/socketClient';

export type MessageDeliveryState = 'sending' | 'sent' | 'failed';
export type RenderedChatMessage = ChatMessage & { readonly delivery: MessageDeliveryState };

export function chatMessageKey(
  message: Pick<ChatMessage, 'sender' | 'clientMessageId'>
): string {
  return `${message.sender.userId}:${message.clientMessageId}`;
}

export function mergeChatMessages(
  current: readonly RenderedChatMessage[],
  incoming: readonly ChatMessage[],
  currentUserId: string
): RenderedChatMessage[] {
  const merged = new Map(current.map((message) => [chatMessageKey(message), message]));
  for (const message of incoming) {
    merged.set(chatMessageKey(message), {
      ...message,
      isOwn: message.sender.userId === currentUserId,
      delivery: 'sent',
    });
  }
  return [...merged.values()].sort((left, right) => {
    const timeDifference = Date.parse(left.sentAt) - Date.parse(right.sentAt);
    return timeDifference || left.id.localeCompare(right.id);
  });
}

export function getRealtimeConnectionLabel(state: RealtimeConnectionState): string {
  if (state === 'connected') return 'En tiempo real';
  if (state === 'connecting') return 'Conectando';
  return 'Sin conexión en tiempo real';
}

export function getConversationRoleLabel(role: Conversation['counterpart']['role']): string {
  return role === 'psychologist' ? 'Profesional de psicología' : 'Paciente';
}

export function formatConversationActivity(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  return new Intl.DateTimeFormat(APP_LOCALE, sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short' }
  ).format(date);
}

export function formatMessageTime(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Sin hora';
  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
