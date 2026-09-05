import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { ProfessionalAvailabilityView } from '../../components/appointment/ProfessionalAvailabilityView';

describe('ProfessionalAvailabilityView', () => {
  it('resume la semana completa sin convertir cada día en una tarjeta', async () => {
    const onEdit = jest.fn();
    const view = await render(
      <ProfessionalAvailabilityView
        timezone="America/Managua"
        rules={[
          { weekday: 1, startTime: '08:00', endTime: '12:00', isActive: true },
          { weekday: 1, startTime: '13:00', endTime: '17:00', isActive: true },
          { weekday: 3, startTime: '09:00', endTime: '15:00', isActive: true },
        ]}
        onEdit={onEdit}
      />
    );

    expect(view.getByText('America/Managua')).toBeTruthy();
    expect(view.getByText('08:00–12:00')).toBeTruthy();
    expect(view.getByText('13:00–17:00')).toBeTruthy();
    expect(view.getByText('2 días disponibles')).toBeTruthy();
    expect(view.getAllByText('No disponible')).toHaveLength(5);

    await fireEvent.press(view.getByRole('button', { name: 'Editar horarios' }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
