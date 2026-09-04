import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { AppointmentScheduleSheet } from '../../components/appointment/AppointmentScheduleSheet';
import type {
  AppointmentPolicy,
  AppointmentRelationship,
  AppointmentSlot,
} from '../../repositories/AppointmentRepository';

const policy: AppointmentPolicy = {
  durationMinutes: 60,
  slotIntervalMinutes: 30,
  minimumLeadMinutes: 120,
  maximumHorizonDays: 30,
  patientCancellationNoticeMinutes: 240,
};

const relationship: AppointmentRelationship = {
  id: 'relationship-1',
  counterpart: {
    userId: 'patient-1',
    displayName: 'María López',
    photoUrl: null,
  },
  enabledModalities: ['CALL', 'CHAT'],
  timezone: 'America/Managua',
  conversationId: null,
};

const slot: AppointmentSlot = {
  startsAt: '2099-09-03T16:00:00.000Z',
  endsAt: '2099-09-03T17:00:00.000Z',
  timezone: 'America/Managua',
};

describe('AppointmentScheduleSheet', () => {
  it('requiere seleccionar un horario antes de confirmar', async () => {
    const onSelectSlot = jest.fn();
    const onConfirm = jest.fn();
    const commonProps = {
      visible: true,
      role: 'patient' as const,
      rescheduling: null,
      policy,
      relationships: [relationship],
      selectedRelationshipId: relationship.id,
      selectedModality: 'CALL' as const,
      slots: [slot],
      isLoadingSlots: false,
      isSubmitting: false,
      error: null,
      onSelectRelationship: jest.fn(),
      onSelectModality: jest.fn(),
      onSelectSlot,
      onConfirm,
      onClose: jest.fn(),
    };
    const view = await render(
      <AppointmentScheduleSheet {...commonProps} selectedSlot={null} />
    );

    expect(view.getByText('Profesional')).toBeTruthy();
    expect(view.queryByText('Paciente')).toBeNull();
    expect(view.getByRole('button', { name: 'Confirmar cita' }).props.accessibilityState)
      .toEqual(expect.objectContaining({ disabled: true }));

    await fireEvent.press(view.getByRole('radio', { name: /Horario/ }));
    expect(onSelectSlot).toHaveBeenCalledWith(slot);

    await view.rerender(<AppointmentScheduleSheet {...commonProps} selectedSlot={slot} />);
    await fireEvent.press(view.getByRole('button', { name: 'Confirmar cita' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
