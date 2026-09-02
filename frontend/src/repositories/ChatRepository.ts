import { apiV1Request } from '../services/apiClient';
import {
  RealtimeConnectionState,
  subscribeToConversation,
} from '../services/socketClient';

export type ConversationModality = 'CHAT' | 'CALL' | 'IN_PERSON';

export interface ConversationCounterpart {
  readonly userId: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly role: 'patient' | 'psychologist';
}

export interface Conversation {
  readonly id: string;
  readonly serviceRequestId: string;
  readonly careRelationshipId: string;
  readonly modality: ConversationModality;
  readonly counterpart: ConversationCounterpart;
  readonly canSend: boolean;
  readonly createdAt: string;
  readonly activityAt: string;
  readonly lastMessage: {
    readonly id: string;
    readonly text: string;
    readonly sentAt: string;
    readonly isOwn: boolean;
  } | null;
}

export interface ChatMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly clientMessageId: string;
  readonly type: 'TEXT';
  readonly text: string;
  readonly sentAt: string;
  readonly sender: ConversationCounterpart;
  readonly isOwn: boolean;
}

export interface MessagingPolicy {
  readonly maximumTextLength: number;
}

interface Envelope<T> { readonly data: T }
interface PageEnvelope<T> {
  readonly data: readonly T[];
  readonly page: { readonly nextCursor: string | null; readonly hasMore: boolean };
}

function queryString(parameters: Record<string, string | number | undefined>): string {
  const query = Object.entries(parameters)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `?${query}` : '';
}

function isConversationCounterpart(value: unknown): value is ConversationCounterpart {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const counterpart = value as Partial<ConversationCounterpart>;
  return typeof counterpart.userId === 'string'
    && typeof counterpart.displayName === 'string'
    && (typeof counterpart.photoUrl === 'string' || counterpart.photoUrl === null)
    && (counterpart.role === 'patient' || counterpart.role === 'psychologist');
}

export async function getMessagingPolicy(signal?: AbortSignal): Promise<MessagingPolicy> {
  return (await apiV1Request<Envelope<MessagingPolicy>>(
    '/conversations/policy',
    'GET',
    undefined,
    { signal }
  )).data;
}

export async function fetchUserConversations(
  cursor?: string,
  signal?: AbortSignal
): Promise<PageEnvelope<Conversation>> {
  return apiV1Request<PageEnvelope<Conversation>>(
    `/conversations${queryString({ cursor })}`,
    'GET',
    undefined,
    { signal }
  );
}

export async function fetchConversation(
  conversationId: string,
  signal?: AbortSignal
): Promise<Conversation> {
  return (await apiV1Request<Envelope<Conversation>>(
    `/conversations/${encodeURIComponent(conversationId)}`,
    'GET',
    undefined,
    { signal }
  )).data;
}

export async function fetchMessages(
  conversationId: string,
  options: {
    readonly cursor?: string;
    readonly direction?: 'before' | 'after';
    readonly signal?: AbortSignal;
  } = {}
): Promise<PageEnvelope<ChatMessage>> {
  return apiV1Request<PageEnvelope<ChatMessage>>(
    `/conversations/${encodeURIComponent(conversationId)}/messages${queryString({
      cursor: options.cursor,
      direction: options.direction,
    })}`,
    'GET',
    undefined,
    { signal: options.signal }
  );
}

export async function sendChatMessage(
  conversationId: string,
  input: { readonly clientMessageId: string; readonly text: string }
): Promise<{ readonly message: ChatMessage; readonly replayed: boolean }> {
  return (await apiV1Request<Envelope<{
    readonly message: ChatMessage;
    readonly replayed: boolean;
  }>>(
    `/conversations/${encodeURIComponent(conversationId)}/messages`,
    'POST',
    { clientMessageId: input.clientMessageId, type: 'TEXT', text: input.text }
  )).data;
}

export function listenToConversation(options: {
  readonly conversationId: string;
  readonly onMessage: (message: ChatMessage) => void;
  readonly onStateChange?: (state: RealtimeConnectionState) => void;
  readonly onError?: (error: Error) => void;
}): () => void {
  return subscribeToConversation({
    conversationId: options.conversationId,
    onStateChange: options.onStateChange,
    onError: options.onError,
    onMessage: (event) => {
      const message = event.message as Partial<ChatMessage>;
      if (
        typeof message.id === 'string'
        && typeof message.conversationId === 'string'
        && typeof message.clientMessageId === 'string'
        && message.type === 'TEXT'
        && typeof message.text === 'string'
        && typeof message.sentAt === 'string'
        && isConversationCounterpart(message.sender)
        && typeof message.isOwn === 'boolean'
        && message.conversationId === options.conversationId
      ) {
        options.onMessage(message as ChatMessage);
      }
    },
  });
}
