import { create } from 'zustand';
import { getSocket, joinRoom, leaveRoom } from '../services/socketClient';
import { Socket } from 'socket.io-client';

export type CallType = 'voice' | 'video';
export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connected';

interface CallInfo {
  roomId: string;
  callType: CallType;
  callerName: string;
}

interface CallStore {
  callState: CallState;
  callType: CallType | null;
  roomId: string | null;
  remoteName: string | null;
  callSeconds: number;

  _timerInterval: ReturnType<typeof setInterval> | null;
  _listenersAttached: boolean;

  initCallListeners: (roomId: string) => void;
  destroyCallListeners: () => void;

  // Psicólogo inicia la llamada
  startCall: (params: { roomId: string; callerName: string; callType: CallType }) => void;
  // Paciente acepta la llamada
  acceptCall: () => void;
  // Cualquiera cuelga
  endCall: () => void;
  // Paciente rechaza
  rejectCall: () => void;

  _startTimer: () => void;
  _stopTimer: () => void;
}

export const useCallStore = create<CallStore>((set, get) => ({
  callState: 'idle',
  callType: null,
  roomId: null,
  remoteName: null,
  callSeconds: 0,
  _timerInterval: null,
  _listenersAttached: false,

  initCallListeners: (roomId: string) => {
    if (get()._listenersAttached) return;

    const socket = getSocket();

    // Unirse a la sala de la sesión
    joinRoom(roomId);

    // Evento que recibe el PACIENTE cuando el psicólogo inicia una llamada
    socket.on('incoming_call', (data: CallInfo) => {
      console.log('[CallStore] Llamada entrante de:', data.callerName);
      set({
        callState: 'incoming',
        callType: data.callType,
        roomId: data.roomId,
        remoteName: data.callerName,
      });
    });

    // Cuando el paciente acepta, el psicólogo recibe este evento
    socket.on('call_accepted', () => {
      console.log('[CallStore] Llamada aceptada – conectando...');
      get()._startTimer();
      set({ callState: 'connected' });
    });

    // Cualquiera cuelga
    socket.on('call_ended', () => {
      console.log('[CallStore] Llamada finalizada');
      get()._stopTimer();
      set({ callState: 'idle', callSeconds: 0 });
    });

    set({ _listenersAttached: true, roomId });
    console.log(`[CallStore] Listeners de llamada inicializados para sala: ${roomId}`);
  },

  destroyCallListeners: () => {
    const socket = getSocket();
    const roomId = get().roomId;

    socket.off('incoming_call');
    socket.off('call_accepted');
    socket.off('call_ended');

    if (roomId) {
      leaveRoom(roomId);
    }

    get()._stopTimer();
    set({
      _listenersAttached: false,
      callState: 'idle',
      callSeconds: 0,
      roomId: null,
    });
    console.log('[CallStore] Listeners de llamada destruidos');
  },

  startCall: ({ roomId, callerName, callType }) => {
    const socket = getSocket();
    socket.emit('start_call', { roomId, callerName, callType });
    set({ callState: 'outgoing', callType, remoteName: null });
  },

  acceptCall: () => {
    const socket = getSocket();
    const roomId = get().roomId;
    if (!roomId) return;
    socket.emit('accept_call', { roomId });
    get()._startTimer();
    set({ callState: 'connected' });
  },

  rejectCall: () => {
    const socket = getSocket();
    const roomId = get().roomId;
    if (!roomId) return;
    socket.emit('end_call', { roomId });
    set({ callState: 'idle', callSeconds: 0 });
  },

  endCall: () => {
    const socket = getSocket();
    const roomId = get().roomId;
    if (!roomId) return;
    socket.emit('end_call', { roomId });
    get()._stopTimer();
    set({ callState: 'idle', callSeconds: 0 });
  },

  _startTimer: () => {
    get()._stopTimer();
    const interval = setInterval(() => {
      set((state) => ({ callSeconds: state.callSeconds + 1 }));
    }, 1000);
    set({ _timerInterval: interval });
  },

  _stopTimer: () => {
    const interval = get()._timerInterval;
    if (interval) clearInterval(interval);
    set({ _timerInterval: null });
  },
}));
