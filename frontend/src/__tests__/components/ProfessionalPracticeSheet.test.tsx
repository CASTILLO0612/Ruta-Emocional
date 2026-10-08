import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ProfessionalPracticeSheet } from '../../components/profile/ProfessionalPracticeSheet';
import type { ProfessionalProfile } from '../../models/ProfessionalProfile';

jest.setTimeout(15_000);

const profile: ProfessionalProfile = {
  id: 'profile-1',
  displayName: 'Diana Castillo',
  email: 'diana@example.com',
  bio: 'Acompañamiento profesional centrado en objetivos compartidos.',
  verificationStatus: 'VERIFIED',
  practiceLocation: null,
  specialties: [{ code: 'CLINICAL', name: 'Psicología clínica', isPrimary: true }],
  modalities: [{
    code: 'CHAT',
    isEnabled: true,
    pricePerHour: { amount: '500.00', currency: 'NIO' },
  }],
  licenses: [],
  availability: { timezone: 'America/Managua', weeklyRules: [], exceptions: [] },
};

describe('ProfessionalPracticeSheet', () => {
  it('conserva la configuración vigente y permite guardarla', async () => {
    const onSave = jest.fn();
    const view = await render(
      <ProfessionalPracticeSheet
        visible
        profile={profile}
        specialties={[
          { code: 'CLINICAL', name: 'Psicología clínica' },
          { code: 'COUPLES', name: 'Terapia de pareja' },
        ]}
        catalogs={{ modalities: ['CHAT', 'CALL'], currencies: ['NIO'] }}
        isLoading={false}
        isSaving={false}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );

    await fireEvent.press(view.getByRole('button', { name: 'Guardar servicios' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      specialtyCodes: ['CLINICAL'],
      primarySpecialtyCode: 'CLINICAL',
    }));
  });

  it('exige tarifa cuando se activa una modalidad nueva', async () => {
    const view = await render(
      <ProfessionalPracticeSheet
        visible
        profile={profile}
        specialties={[{ code: 'CLINICAL', name: 'Psicología clínica' }]}
        catalogs={{ modalities: ['CHAT', 'CALL'], currencies: ['NIO'] }}
        isLoading={false}
        isSaving={false}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );

    await fireEvent(view.getByLabelText('Activar Llamada'), 'valueChange', true);

    expect(view.getByRole('button', { name: 'Guardar servicios' }).props.accessibilityState)
      .toEqual(expect.objectContaining({ disabled: true }));
  });
});
