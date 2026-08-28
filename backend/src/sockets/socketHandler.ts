import { Server, Socket } from 'socket.io';
import { IdentityService } from '../modules/identity/application/identityService';
import { RoleCode } from '../modules/identity/domain/identityTypes';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de eventos tipados para comunicación bidireccional
// ─────────────────────────────────────────────────────────────────────────────

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userEmail?: string;
  userRoles?: readonly RoleCode[];
}

interface ChatMessageData {
  roomId: string;
  message: {
    id?: string;
    sender: string;
    senderName: string;
    senderRole: 'patient' | 'psychologist';
    text: string;
    type?: 'text' | 'image' | 'audio' | 'system';
    createdAt?: string;
  };
}

interface CallData {
  roomId: string;
  callerName: string;
  callType: 'voice' | 'video';
}

interface LocationData {
  roomId: string;
  userId: string;
  latitude: number;
  longitude: number;
  heading?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Autenticación JWT en el handshake de Socket.io
// ─────────────────────────────────────────────────────────────────────────────

function authenticateSocket(
  identity: IdentityService,
  socket: AuthenticatedSocket,
  next: (error?: Error) => void
): void {
  const handshakeToken = socket.handshake.auth?.token;
  const authorization = socket.handshake.headers?.authorization;
  const token = typeof handshakeToken === 'string'
    ? handshakeToken
    : typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;

  if (!token) {
    next(new Error('UNAUTHORIZED'));
    return;
  }

  void identity.authenticateAccessToken(token)
    .then(({ user }) => {
      socket.userId = user.id;
      socket.userEmail = user.email;
      socket.userRoles = user.roles;
      next();
    })
    .catch(() => next(new Error('UNAUTHORIZED')));
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup principal de WebSockets
// ─────────────────────────────────────────────────────────────────────────────

export function setupSockets(io: Server, identity: IdentityService): void {
  // Middleware de autenticación
  io.use((socket, next) => authenticateSocket(identity, socket as AuthenticatedSocket, next));

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    const userLabel = socket.userEmail || `anon-${socket.id}`;
    console.log(`[Socket.io] Cliente conectado: ${userLabel} (${socket.id})`);

    // ── Gestión de salas ──────────────────────────────────────────────────

    socket.on('join_room', (roomId: string) => {
      if (!roomId) return;
      const roomStr = String(roomId);
      socket.join(roomStr);
      console.log(`[Socket.io] ${userLabel} se unió a sala: ${roomStr}`);
    });

    socket.on('leave_room', (roomId: string) => {
      if (!roomId) return;
      const roomStr = String(roomId);
      socket.leave(roomStr);
      console.log(`[Socket.io] ${userLabel} salió de sala: ${roomStr}`);
    });

    // ── Eventos de Chat en Tiempo Real ────────────────────────────────────

    socket.on('send_message', (data: ChatMessageData) => {
      if (!data?.roomId || !data?.message?.text) return;
      console.log(`[Socket.io Chat] Mensaje en sala ${data.roomId}: "${data.message.text.substring(0, 50)}..."`);
      // Emitir a todos en la sala (incluido el emisor para confirmación)
      io.to(data.roomId).emit('receive_message', data.message);
    });

    // ── Señalización de Llamadas (Voz / Video) ───────────────────────────

    socket.on('start_call', (data: CallData) => {
      if (!data?.roomId) return;
      console.log(`[Socket.io Call] ${data.callerName} inicia ${data.callType} en sala: ${data.roomId}`);
      socket.to(data.roomId).emit('incoming_call', data);
    });

    socket.on('accept_call', (data: { roomId: string }) => {
      if (!data?.roomId) return;
      console.log(`[Socket.io Call] Llamada aceptada en sala: ${data.roomId}`);
      io.to(data.roomId).emit('call_accepted', data);
    });

    socket.on('end_call', (data: { roomId: string }) => {
      if (!data?.roomId) return;
      console.log(`[Socket.io Call] Llamada finalizada en sala: ${data.roomId}`);
      io.to(data.roomId).emit('call_ended', data);
    });

    // ── Eventos de Geolocalización en Tiempo Real ─────────────────────────

    socket.on('location_update', (data: LocationData) => {
      if (!data?.roomId || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return;
      // Emitir actualización de posición a la sala (para tracking presencial)
      socket.to(data.roomId).emit('receive_location_update', {
        userId: data.userId || socket.userId,
        latitude: data.latitude,
        longitude: data.longitude,
        heading: data.heading,
        timestamp: new Date().toISOString(),
      });
    });

    // ── Desconexión ───────────────────────────────────────────────────────

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.io] Desconectado: ${userLabel} (${socket.id}) — Razón: ${reason}`);
    });
  });
}
