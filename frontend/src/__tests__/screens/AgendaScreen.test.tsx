import React from 'react';
import { fireEvent } from '@testing-library/react-native';

import { useAppointmentAgenda } from '../../hooks/useAppointmentAgenda';
import { useProfessionalAvailability } from '../../hooks/useProfessionalAvailability';
import { AgendaScreen } from '../../screens/shared/AgendaScreen';
import { useAuthStore } from '../../store/useAuthStore';
import { renderWithStackNavigation } from '../helpers/renderWithNavigation';

jest.mock('../../hooks/useAppointmentAgenda', () => ({ useAppointmentAgenda: jest.fn() }));
jest.mock('../../hooks/useProfessionalAvailability', () => ({
  useProfessionalAvailability: jest.fn(),
}));

const mockedAppointmentAgenda = jest.mocked(useAppointmentAgenda);
const mockedProfessionalAvailability = jest.mocked(useProfessionalAvailability);

describe('AgendaScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({
      role: 'psychologist',
      isAuthenticated: true,
      isLoading: false,
      userProfile: {
        id: 'psychologist-1',
        displayName: 'Dra. Ana Torres',
        email: 'ana@example.test',
        photoUrl: null,
        status: 'ACTIVE',
        roles: ['psychologist'],
        role: 'psychologist',
        psychologistVerificationStatus: 'VERIFIED',
        capabilities: [
          'appointment:read:self',
          'appointment:create:self',
          'availability:manage:self',
        ],
      },
    });

    mockedAppointmentAgenda.mockReturnValue({
      relationships: [],
      policy: null,
      upcoming: [],
      history: [],
      isLoading: false,
      isRefreshing: false,
      error: null,
      reminderMessage: null,
      dismissReminder: jest.fn(),
      refresh: jest.fn(),
      openSchedule: jest.fn(),
      handlePrimaryAction: jest.fn(),
      optionsAppointment: null,
      setOptionsAppointment: jest.fn(),
      handleOptionsReschedule: jest.fn(),
      handleCancel: jest.fn(),
      mutationId: null,
      schedule: {
        visible: false,
        rescheduling: null,
        selectedRelationshipId: null,
        selectedModality: null,
        slots: [],
        selectedSlot: null,
        isLoadingSlots: false,
        isSubmitting: false,
        error: null,
        onSelectRelationship: jest.fn(),
        onSelectModality: jest.fn(),
        onSelectSlot: jest.fn(),
        onConfirm: jest.fn(),
        onClose: jest.fn(),
      },
    });

    mockedProfessionalAvailability.mockReturnValue({
      profile: {
        id: 'profile-1',
        displayName: 'Dra. Ana Torres',
        email: 'ana@example.test',
        bio: null,
        verificationStatus: 'VERIFIED',
        specialties: [],
        modalities: [],
        licenses: [],
        availability: {
          timezone: 'America/Managua',
          weeklyRules: [
            { weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true },
          ],
        },
      },
      timezone: 'America/Managua',
      isLoading: false,
      isRefreshing: false,
      isSaving: false,
      isSheetOpen: false,
      error: null,
      mutationError: null,
      load: jest.fn(),
      refresh: jest.fn(),
      save: jest.fn(),
      openEditor: jest.fn(),
      closeEditor: jest.fn(),
    });
  });

  it('separa las citas de la configuración de disponibilidad profesional', async () => {
    const view = await renderWithStackNavigation({
      screens: [{ name: 'Agenda', component: AgendaScreen }],
      initialRouteName: 'Agenda',
    });

    expect(view.getByText('No hay citas próximas')).toBeTruthy();
    await fireEvent.press(view.getByRole('tab', { name: 'Disponibilidad' }));

    expect(view.getByText('Tu semana de atención')).toBeTruthy();
    expect(view.getByText('08:00–12:00')).toBeTruthy();
    expect(view.queryByText('No hay citas próximas')).toBeNull();
  });
});
