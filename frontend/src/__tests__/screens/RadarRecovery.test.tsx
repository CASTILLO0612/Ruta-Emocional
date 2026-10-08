import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';

import { RadarScreen } from '../../screens/patient/RadarScreen';
import { useAuthStore } from '../../store/useAuthStore';
import { useRequestStore } from '../../store/useRequestStore';

const mockReset = jest.fn();
const cancelSearch = jest.fn(async () => undefined);

jest.mock('../../components/common/CustomMapView', () => () => {
  throw new Error('Native map unavailable');
});

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const ReactModule = require('react');
  return {
    ...actual,
    useNavigation: () => ({ reset: mockReset, navigate: jest.fn(), replace: jest.fn() }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactModule.useEffect(effect, [effect]);
    },
  };
});

describe('Radar recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        modality: 'call',
        proposedBudget: 800,
        currencyCode: 'NIO',
        status: 'pending',
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
      },
      incomingOffers: [],
      error: null,
      cancelSearch,
      clearError: jest.fn(),
    });
  });

  it('permite cancelar una búsqueda activa cuando la pantalla no puede renderizarse', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const view = await render(<RadarScreen />);

      expect(view.getByText('No pudimos abrir la búsqueda')).toBeTruthy();
      await act(async () => {
        fireEvent.press(view.getByLabelText('Cancelar búsqueda activa'));
      });

      await waitFor(() => {
        expect(cancelSearch).toHaveBeenCalledWith('patient-1');
        expect(mockReset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'PatientMain', params: { screen: 'Search' } }],
        });
      });
    } finally {
      consoleError.mockRestore();
    }
  });
});
