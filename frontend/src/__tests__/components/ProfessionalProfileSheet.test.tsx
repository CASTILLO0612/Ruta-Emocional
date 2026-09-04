import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ProfessionalProfileSheet } from '../../components/profile/ProfessionalProfileSheet';

describe('ProfessionalProfileSheet', () => {
  it('explica la especialidad de solo lectura y bloquea una bio demasiado breve', async () => {
    const view = await render(
      <ProfessionalProfileSheet
        visible
        specialty="Psicología clínica"
        bio="Texto breve"
        isSaving={false}
        onBioChange={jest.fn()}
        onSave={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(view.getByText('Psicología clínica')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Guardar presentación' }).props.accessibilityState)
      .toEqual(expect.objectContaining({ disabled: true }));
  });

  it('permite guardar una presentación válida', async () => {
    const onSave = jest.fn();
    const view = await render(
      <ProfessionalProfileSheet
        visible
        specialty="Psicología clínica"
        bio="Acompañamiento clínico basado en evidencia y objetivos compartidos."
        isSaving={false}
        onBioChange={jest.fn()}
        onSave={onSave}
        onClose={jest.fn()}
      />
    );

    await fireEvent.press(view.getByRole('button', { name: 'Guardar presentación' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
