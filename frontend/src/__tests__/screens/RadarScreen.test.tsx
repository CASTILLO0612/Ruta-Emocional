import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { RadarScreen } from '../../screens/patient/RadarScreen';
import { useAuthStore } from '../../store/useAuthStore';
import { useRequestStore } from '../../store/useRequestStore';

const mockReset = jest.fn();

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactModule = require('react');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      replace: jest.fn(),
      reset: mockReset,
    }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactModule.useEffect(effect, [effect]);
    },
  };
});

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getLastKnownPositionAsync: jest.fn(async () => null),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 11.93, longitude: -85.96 },
  })),
}));

jest.mock('../../repositories/PsychologistRepository', () => ({
  getNearbyPsychologists: jest.fn(async () => []),
}));

jest.mock('../../config/runtimeConfig', () => ({
  getDirectoryMapConfig: () => ({
    radiusKm: 25,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
    defaultLatitude: 12.1328,
    defaultLongitude: -86.2904,
  }),
}));

describe('RadarScreen', () => {
  beforeEach(() => {
    mockReset.mockClear();
    useAuthStore.setState({
      userProfile: {
        id: 'patient-1',
        displayName: 'Paciente QA',
        email: 'paciente@example.com',
        photoUrl: null,
        status: 'ACTIVE',
        roles: ['patient'],
        role: 'patient',
        psychologistVerificationStatus: null,
        capabilities: [],
      },
      isAuthenticated: true,
      isLoading: false,
      role: 'patient',
    });
    useRequestStore.setState({
      sessionUserId: 'patient-1',
      activeRequestId: 'request-1',
      activeRequest: {
        id: 'request-1',
        modality: 'in-person',
        proposedBudget: 800,
        currencyCode: 'NIO',
        status: 'pending',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      },
      incomingOffers: [],
      error: null,
      cancelSearch: jest.fn(async () => {
        useRequestStore.setState({ activeRequest: null, activeRequestId: null });
      }),
      startListeningToOffers: jest.fn(),
    });
  });

  it('vuelve de forma explícita a Buscar después de cancelar', async () => {
    const view = await render(<RadarScreen />);

    await act(async () => {
      fireEvent.press(view.getByLabelText('Cancelar búsqueda'));
    });
    const confirmCancellation = await view.findByLabelText('Sí, cancelar');
    await act(async () => {
      fireEvent.press(confirmCancellation);
    });

    await waitFor(() => expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'PatientMain', params: { screen: 'Search' } }],
    }));
    view.unmount();
  });

  it('monta el mapa antes de esperar una lectura GPS nueva', async () => {
    const view = await render(<RadarScreen />);

    expect(view.getByTestId('custom-map-view')).toBeTruthy();
    view.unmount();
  });

  it('conserva el mapa interactivo para búsquedas por llamada', async () => {
    useRequestStore.setState((state) => ({
      ...state,
      activeRequest: state.activeRequest
        ? { ...state.activeRequest, modality: 'call' }
        : null,
    }));

    const view = await render(<RadarScreen />);

    expect(view.getByTestId('custom-map-view')).toBeTruthy();
    view.unmount();
  });
});
