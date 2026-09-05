import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AppointmentOptionsSheet } from '../../components/appointment/AppointmentOptionsSheet';
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

describe('AppointmentOptionsSheet', () => {
  it('pide motivo y una segunda confirmación antes de cancelar', async () => {
    const onCancel = jest.fn();
    const view = await render(
      <AppointmentOptionsSheet
        appointment={appointment}
        role="patient"
        isSubmitting={false}
        onReschedule={jest.fn()}
        onCancel={onCancel}
        onClose={jest.fn()}
      />
    );

    await fireEvent.press(view.getByRole('button', { name: 'Cancelar cita' }));
    expect(view.getByText('La cancelación quedará registrada y será visible para ambas partes.'))
      .toBeTruthy();

    const confirm = view.getByRole('button', { name: 'Confirmar cancelación' });
    expect(confirm.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));

    await fireEvent.changeText(view.getByLabelText('Motivo de cancelación'), 'Imprevisto familiar');
    await fireEvent.press(view.getByRole('button', { name: 'Confirmar cancelación' }));

    expect(onCancel).toHaveBeenCalledWith(appointment, 'Imprevisto familiar');
  });
});
