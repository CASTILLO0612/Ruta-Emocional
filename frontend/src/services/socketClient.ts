import { io, Socket } from 'socket.io-client';
import { getApiOrigin } from '../config/runtimeConfig';
import { getAuthToken } from './apiClient';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración de conexión
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Singleton de Socket.io con autenticación JWT y reconexión automática
// ─────────────────────────────────────────────────────────────────────────────

let socketInstance: Socket | null = null;
let currentRooms: Set<string> = new Set();

/**
 * Obtiene (o crea) la instancia singleton del socket con JWT.
 * Automáticamente envía el token en el handshake de autenticación.
 */
export function getSocket(): Socket {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  const token = getAuthToken();

  socketInstance = io(getApiOrigin(), {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    auth: {
      token: token || undefined,
    },
  });

  socketInstance.on('connect', () => {
    console.log(`[SocketClient] Conectado: ${socketInstance?.id}`);
    // Rejoin rooms after reconnection
    currentRooms.forEach((roomId) => {
      socketInstance?.emit('join_room', roomId);
      console.log(`[SocketClient] Re-unido a sala: ${roomId}`);
    });
  });

  socketInstance.on('disconnect', (reason: string) => {
    console.log(`[SocketClient] Desconectado: ${reason}`);
  });

  socketInstance.on('connect_error', (err: Error) => {
    console.warn(`[SocketClient] Error de conexión:`, err.message);
  });

  return socketInstance;
}

/**
 * Unirse a una sala (request room, session room, etc.)
 */
export function joinRoom(roomId: string): void {
  const socket = getSocket();
  currentRooms.add(roomId);
  socket.emit('join_room', roomId);
  console.log(`[SocketClient] Unido a sala: ${roomId}`);
}

/**
 * Salir de una sala
 */
export function leaveRoom(roomId: string): void {
  const socket = getSocket();
  currentRooms.delete(roomId);
  socket.emit('leave_room', roomId);
  console.log(`[SocketClient] Salido de sala: ${roomId}`);
}

/**
 * Desconecta completamente el socket y limpia el singleton.
 * Usar al cerrar sesión.
 */
export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.removeAllListeners();
    socketInstance.disconnect();
    socketInstance = null;
    currentRooms.clear();
    console.log('[SocketClient] Socket desconectado y limpiado');
  }
}

/**
 * Reconecta con un nuevo token (por ej. después de login).
 */
export function reconnectWithToken(): void {
  disconnectSocket();
  getSocket();
}
