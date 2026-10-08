import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { CallSessionScreen } from '../../screens/shared/CallSessionScreen.native';
import {
  finishCall,
  getCall,
  joinCall,
  startCall,
} from '../../repositories/CallRepository';

const mockLiveKitRoom = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
  useRoute: jest.fn(),
}));

jest.mock('@livekit/react-native', () => {
  const ReactModule = require('react');
  const NativeView = require('react-native').View;
  return {
    AudioSession: {
      startAudioSession: jest.fn(async () => undefined),
      stopAudioSession: jest.fn(async () => undefined),
    },
    LiveKitRoom: ({ children, ...props }: { readonly children: React.ReactNode; readonly onDisconnected?: () => void }) => {
      mockLiveKitRoom(props);
      return ReactModule.createElement(NativeView, { testID: 'livekit-room' }, children);
    },
    VideoTrack: () => ReactModule.createElement(NativeView),
    isTrackReference: () => false,
    registerGlobals: jest.fn(),
    useRemoteParticipants: () => [],
    useRoomContext: () => ({
      localParticipant: {
        identity: 'patient-1',
        setCameraEnabled: jest.fn(async () => undefined),
        setMicrophoneEnabled: jest.fn(async () => undefined),
      },
    }),
    useTracks: () => [],
  };
});

jest.mock('livekit-client', () => ({ Track: { Source: { Camera: 'camera' } } }));

jest.mock('../../repositories/CallRepository', () => ({
  startCall: jest.fn(),
  getCall: jest.fn(),
  joinCall: jest.fn(),
  finishCall: jest.fn(),
  declineCall: jest.fn(),
}));

jest.mock('../../services/socketClient', () => ({
  subscribeToCallUpdates: jest.fn(() => () => undefined),
}));

const call = {
  id: '37cb148e-675f-4e74-98bf-7961eb82693c',
  conversationId: '17f10ff0-d4de-4a75-9a4f-d1c3d6a2d0a8',
  initiatorUserId: '6c8291e5-8557-4d72-aa77-8325c61fb55c',
  mediaType: 'AUDIO' as const,
  status: 'RINGING' as const,
  initiator: { userId: '6c8291e5-8557-4d72-aa77-8325c61fb55c', displayName: 'Paciente', photoUrl: null },
  counterpart: { userId: '9a76aaf8-13a2-4f49-bd38-6b0e21910994', displayName: 'Profesional', photoUrl: null },
  createdAt: '2026-10-07T12:00:00.000Z',
  acceptedAt: null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
};

const connection = {
  call,
  credentials: { serverUrl: 'wss://rtc.example.test', accessToken: 'ephemeral-token' },
};

const mockedUseNavigation = jest.mocked(useNavigation);
const mockedUseRoute = jest.mocked(useRoute);
const mockedStartCall = jest.mocked(startCall);
const mockedGetCall = jest.mocked(getCall);
const mockedJoinCall = jest.mocked(joinCall);
const mockedFinishCall = jest.mocked(finishCall);

describe('CallSessionScreen', () => {
  const goBack = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseNavigation.mockReturnValue({
      canGoBack: () => true,
      goBack,
      navigate: jest.fn(),
    } as never);
  });

  it('inicia una llamada saliente sin exponer credenciales administrativas', async () => {
    mockedUseRoute.mockReturnValue({
      params: { conversationId: call.conversationId, mediaType: 'AUDIO', direction: 'OUTGOING' },
    } as never);
    mockedStartCall.mockResolvedValue(connection);
    mockedFinishCall.mockResolvedValue();

    const view = await render(<CallSessionScreen />);

    await waitFor(() => expect(mockedStartCall).toHaveBeenCalledWith(call.conversationId, 'AUDIO'));
    expect(view.getByTestId('livekit-room')).toBeTruthy();
    expect(view.queryByText('ephemeral-token')).toBeNull();

    await act(async () => {
      fireEvent.press(view.getByLabelText('Finalizar'));
    });
    await waitFor(() => expect(mockedFinishCall).toHaveBeenCalledWith(call.id));
    expect(goBack).toHaveBeenCalled();
  });

  it('obtiene y acepta únicamente una llamada entrante pendiente', async () => {
    mockedUseRoute.mockReturnValue({
      params: {
        callId: call.id,
        conversationId: call.conversationId,
        mediaType: 'AUDIO',
        direction: 'INCOMING',
      },
    } as never);
    mockedGetCall.mockResolvedValue(call);
    mockedJoinCall.mockResolvedValue({ ...connection, call: { ...call, status: 'ACTIVE' } });

    const view = await render(<CallSessionScreen />);

    await waitFor(() => expect(view.getByLabelText('Contestar')).toBeTruthy());
    await act(async () => {
      fireEvent.press(view.getByLabelText('Contestar'));
    });
    await waitFor(() => expect(mockedJoinCall).toHaveBeenCalledWith(call.id));
    expect(view.getByTestId('livekit-room')).toBeTruthy();
  });

  it('no finaliza para ambos usuarios ante una desconexión transitoria', async () => {
    mockedUseRoute.mockReturnValue({
      params: { conversationId: call.conversationId, mediaType: 'AUDIO', direction: 'OUTGOING' },
    } as never);
    mockedStartCall.mockResolvedValue({ ...connection, call: { ...call, status: 'ACTIVE' } });

    const view = await render(<CallSessionScreen />);
    await waitFor(() => expect(view.getByTestId('livekit-room')).toBeTruthy());

    const latestRoomProps = mockLiveKitRoom.mock.calls.at(-1)?.[0] as { readonly onDisconnected?: () => void } | undefined;
    await act(async () => {
      latestRoomProps?.onDisconnected?.();
    });

    await waitFor(() => expect(mockedFinishCall).not.toHaveBeenCalled());
    expect(view.getByLabelText('Reintentar conexión')).toBeTruthy();
  });
});
