import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AppointmentCard } from '../../components/appointment/AppointmentCard';
import type { Appointment } from '../../repositories/AppointmentRepository';

const appointment: Appointment = {
  id: 'appointment-1',
  careRelationshipId: 'relationship-1',
  counterpart: {
    userId: 'psychologist-1',
    displayName: 'Dra. Ana Torres',
    photoUrl: null,
  },
  modality: 'CALL',
  startsAt: '2099-09-03T16:00:00.000Z',
  endsAt: '2099-09-03T17:00:00.000Z',
  timezone: 'America/Managua',
  status: 'SCHEDULED',
  cancellationReason: null,
  createdAt: '2099-09-01T15:00:00.000Z',
  updatedAt: '2099-09-01T15:00:00.000Z',
};

describe('AppointmentCard', () => {
  it('mantiene una sola acción principal y reúne las secundarias en Opciones', async () => {
    const onPrimaryAction = jest.fn();
    const onOpenOptions = jest.fn();
    const view = await render(
      <AppointmentCard
        appointment={appointment}
        role="psychologist"
        isBusy={false}
        onPrimaryAction={onPrimaryAction}
        onOpenOptions={onOpenOptions}
      />
    );

    expect(view.getByText('Dra. Ana Torres')).toBeTruthy();
    expect(view.getByText('Pendiente')).toBeTruthy();
    expect(view.queryByText('Reprogramar')).toBeNull();
    expect(view.queryByText('Cancelar')).toBeNull();

    await fireEvent.press(view.getByRole('button', { name: 'Confirmar cita' }));
    await fireEvent.press(view.getByRole('button', { name: 'Opciones' }));

    expect(onPrimaryAction).toHaveBeenCalledWith(
      appointment,
      { type: 'transition', label: 'Confirmar cita', transition: 'CONFIRM' }
    );
    expect(onOpenOptions).toHaveBeenCalledWith(appointment);
  });
});
