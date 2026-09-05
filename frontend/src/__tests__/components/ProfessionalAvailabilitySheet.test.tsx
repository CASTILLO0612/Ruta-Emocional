import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ProfessionalAvailabilitySheet } from '../../components/appointment/ProfessionalAvailabilitySheet';

describe('ProfessionalAvailabilitySheet', () => {
  it('preserva y permite guardar varios intervalos del mismo día', async () => {
    const onSubmit = jest.fn();
    const view = await render(
      <ProfessionalAvailabilitySheet
        visible
        timezone="America/Managua"
        rules={[
          { weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true },
        ]}
        isSubmitting={false}
        error={null}
        onSubmit={onSubmit}
        onClose={jest.fn()}
      />
    );

    await fireEvent.press(view.getByRole('button', { name: 'Agregar otro intervalo el Lunes' }));
    expect(view.getByLabelText('Lunes, intervalo 2, hora de inicio').props.value).toBe('12:00');
    expect(view.getByLabelText('Lunes, intervalo 2, hora de fin').props.value).toBe('13:00');

    await fireEvent.press(view.getByRole('button', { name: 'Guardar disponibilidad' }));

    expect(onSubmit).toHaveBeenCalledWith([
      { weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true },
      { weekday: 1, startTime: '12:00', endTime: '13:00', isActive: true },
    ]);
  });

  it('bloquea el guardado cuando existen intervalos superpuestos', async () => {
    const view = await render(
      <ProfessionalAvailabilitySheet
        visible
        timezone="America/Managua"
        rules={[
          { weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true },
          { weekday: 1, startTime: '11:00', endTime: '14:00', isActive: true },
        ]}
        isSubmitting={false}
        error={null}
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(view.getByText('Los intervalos de este día no pueden superponerse.')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Guardar disponibilidad' }).props.accessibilityState)
      .toEqual(expect.objectContaining({ disabled: true }));
  });
});
