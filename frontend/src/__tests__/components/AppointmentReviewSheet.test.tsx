import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AppointmentReviewSheet } from '../../components/appointment/AppointmentReviewSheet';
import type { Appointment } from '../../repositories/AppointmentRepository';

const appointment: Appointment = {
  id: 'appointment-1',
  careRelationshipId: 'relationship-1',
  counterpart: { userId: 'psychologist-1', displayName: 'Dra. Ana Torres', photoUrl: null },
  modality: 'IN_PERSON',
  startsAt: '2099-09-03T16:00:00.000Z',
  endsAt: '2099-09-03T17:00:00.000Z',
  timezone: 'America/Managua',
  status: 'COMPLETED',
  cancellationReason: null,
  review: null,
  createdAt: '2099-09-01T15:00:00.000Z',
  updatedAt: '2099-09-03T17:00:00.000Z',
};

describe('AppointmentReviewSheet', () => {
  it('exige una calificación y envía un comentario normalizado', async () => {
    const onSubmit = jest.fn();
    const view = await render(
      <AppointmentReviewSheet
        appointment={appointment}
        isSubmitting={false}
        error={null}
        onSubmit={onSubmit}
        onClose={jest.fn()}
      />
    );

    expect(view.getByRole('button', { name: 'Enviar opinión' }).props.accessibilityState)
      .toEqual(expect.objectContaining({ disabled: true }));
    await fireEvent.press(view.getByRole('radio', { name: '5 estrellas' }));
    await fireEvent.changeText(view.getByLabelText('Comentario sobre la atención'), '  Excelente atención.  ');
    await fireEvent.press(view.getByRole('button', { name: 'Enviar opinión' }));

    expect(onSubmit).toHaveBeenCalledWith(appointment, 5, 'Excelente atención.');
  });
});
