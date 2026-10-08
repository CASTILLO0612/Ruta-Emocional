import React from 'react';
import { Text } from 'react-native';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { ProfessionalDirectoryScreen } from '../../screens/patient/ProfessionalDirectoryScreen';
import { renderWithStackNavigation } from '../helpers/renderWithNavigation';
import * as ProfessionalRepository from '../../repositories/ProfessionalProfileRepository';
import * as PsychologistRepository from '../../repositories/PsychologistRepository';

jest.mock('../../repositories/ProfessionalProfileRepository');
jest.mock('../../repositories/PsychologistRepository');

const profile = {
  id: 'profile-1',
  displayName: 'Diana Castillo',
  specialty: 'Psicología clínica',
  specialties: [{ code: 'CLINICAL', name: 'Psicología clínica' }],
  rating: 4.8,
  totalReviews: 12,
  pricePerHour: '500.00',
  currencyCode: 'NIO',
  modalities: ['call' as const],
  isAvailable: true,
  credentialAuthority: 'MINSA',
};

const MockPsychologistProfileScreen = () => <Text>Detalle profesional</Text>;

describe('ProfessionalDirectoryScreen', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(ProfessionalRepository.getSpecialtyCatalog).mockResolvedValue([
      { code: 'CLINICAL', name: 'Psicología clínica' },
    ]);
    jest.mocked(PsychologistRepository.getAvailablePsychologistPage).mockResolvedValue({
      items: [profile],
      nextCursor: null,
    });
  });

  it('lista perfiles verificados y aplica filtros de modalidad', async () => {
    const view = await renderWithStackNavigation({
      screens: [
        { name: 'ProfessionalDirectory', component: ProfessionalDirectoryScreen },
        { name: 'PsychologistProfile', component: MockPsychologistProfileScreen },
      ],
      initialRouteName: 'ProfessionalDirectory',
    });

    expect(await view.findByText('Diana Castillo')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByRole('radio', { name: 'Llamada' }));
    });

    await waitFor(() => {
      expect(PsychologistRepository.getAvailablePsychologistPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ modality: 'CALL', limit: 20 }),
        expect.any(AbortSignal)
      );
    });
  });
});
