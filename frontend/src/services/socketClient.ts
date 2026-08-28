import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from '../config/runtimeConfig';
import { getAuthToken } from './apiClient';

interface MessageCreatedEvent {
  readonly conversationId: string;
  readonly message: unknown;
}

interface ServerEvents {
  'message.created': (event: MessageCreatedEvent) => void;
}

interface SubscriptionAck {
  readonly ok: boolean;
  readonly code?: string;
}

interface ClientEvents {
  'conversation.subscribe': (
    payload: { readonly conversationId: string },
    acknowledge: (result: SubscriptionAck) => void
  ) => void;
  'conversation.unsubscribe': (payload: { readonly conversationId: string }) => void;
}

type RefreshAccessToken = () => Promise<string | null>;
export type RealtimeConnectionState = 'connecting' | 'connected' | 'disconnected';

let socketInstance: Socket<ServerEvents, ClientEvents> | null = null;
let refreshAccessToken: RefreshAccessToken | null = null;
let refreshInFlight: Promise<void> | null = null;
const subscriptionCounts = new Map<string, number>();

export function configureSocketAuthRefresh(handler: RefreshAccessToken): void {
  refreshAccessToken = handler;
}

function updateSocketToken(socket: Socket<ServerEvents, ClientEvents>): boolean {
  const token = getAuthToken();
  socket.auth = { token: token ?? undefined };
  return Boolean(token);
}

function subscribe(socket: Socket<ServerEvents, ClientEvents>, conversationId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.timeout(5000).emit(
      'conversation.subscribe',
      { conversationId },
      (timeoutError: Error | null, result?: SubscriptionAck) => {
        if (timeoutError) return reject(timeoutError);
        if (!result?.ok) return reject(new Error(result?.code ?? 'SUBSCRIPTION_FAILED'));
        resolve();
      }
    );
  });
}

function createSocket(): Socket<ServerEvents, ClientEvents> {
  const socket = io(getApiOrigin(), {
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect_error', (error) => {
    if (error.message !== 'UNAUTHORIZED' || !refreshAccessToken || refreshInFlight) return;
    refreshInFlight = refreshAccessToken()
      .then((token) => {
        if (!token) return;
        updateSocketToken(socket);
        socket.connect();
      })
      .finally(() => {
        refreshInFlight = null;
      });
  });
  socket.io.on('reconnect_attempt', () => updateSocketToken(socket));
  updateSocketToken(socket);
  socket.connect();
  return socket;
}

function getSocket(): Socket<ServerEvents, ClientEvents> {
  if (!socketInstance) socketInstance = createSocket();
  if (!socketInstance.connected && !socketInstance.active && updateSocketToken(socketInstance)) {
    socketInstance.connect();
  }
  return socketInstance;
}

export function subscribeToConversation(options: {
  readonly conversationId: string;
  readonly onMessage: (event: MessageCreatedEvent) => void;
  readonly onStateChange?: (state: RealtimeConnectionState) => void;
  readonly onError?: (error: Error) => void;
}): () => void {
  const socket = getSocket();
  subscriptionCounts.set(
    options.conversationId,
    (subscriptionCounts.get(options.conversationId) ?? 0) + 1
  );

  const onConnect = () => {
    options.onStateChange?.('connected');
    void subscribe(socket, options.conversationId).catch((error: unknown) => {
      options.onError?.(error instanceof Error ? error : new Error('SUBSCRIPTION_FAILED'));
    });
  };
  const onDisconnect = () => options.onStateChange?.('disconnected');
  const onMessage = (event: MessageCreatedEvent) => {
    if (event.conversationId === options.conversationId) options.onMessage(event);
  };

  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);
  socket.on('message.created', onMessage);
  options.onStateChange?.(socket.connected ? 'connected' : 'connecting');
  if (socket.connected) onConnect();

  return () => {
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
    socket.off('message.created', onMessage);
    const remainingSubscriptions = (subscriptionCounts.get(options.conversationId) ?? 1) - 1;
    if (remainingSubscriptions <= 0) {
      subscriptionCounts.delete(options.conversationId);
      socket.emit('conversation.unsubscribe', { conversationId: options.conversationId });
    } else {
      subscriptionCounts.set(options.conversationId, remainingSubscriptions);
    }
  };
}

export function disconnectSocket(): void {
  subscriptionCounts.clear();
  if (!socketInstance) return;
  socketInstance.removeAllListeners();
  socketInstance.disconnect();
  socketInstance = null;
}
