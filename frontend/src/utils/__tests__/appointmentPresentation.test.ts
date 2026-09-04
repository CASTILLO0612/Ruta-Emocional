import type {
  Appointment,
  AppointmentSlot,
} from '../../repositories/AppointmentRepository';
import {
  formatAppointmentDate,
  getAppointmentActionPlan,
  groupAppointmentSlots,
} from '../appointmentPresentation';

const referenceNow = new Date('2026-09-02T15:00:00.000Z');

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appointment-1',
    careRelationshipId: 'relationship-1',
    counterpart: {
      userId: 'user-1',
      displayName: 'Ana Torres',
      photoUrl: null,
    },
    modality: 'CALL',
    startsAt: '2026-09-03T16:00:00.000Z',
    endsAt: '2026-09-03T17:00:00.000Z',
    timezone: 'America/Managua',
    status: 'SCHEDULED',
    cancellationReason: null,
    createdAt: '2026-09-01T15:00:00.000Z',
    updatedAt: '2026-09-01T15:00:00.000Z',
    ...overrides,
  };
}

describe('appointmentPresentation', () => {
  it('prioriza el siguiente paso clínico del psicólogo y mantiene las opciones secundarias', () => {
    expect(getAppointmentActionPlan(appointment(), 'psychologist', referenceNow)).toEqual({
      primary: { type: 'transition', label: 'Confirmar cita', transition: 'CONFIRM' },
      secondary: [
        { type: 'reschedule', label: 'Reprogramar' },
        { type: 'cancel', label: 'Cancelar' },
      ],
    });

    expect(getAppointmentActionPlan(
      appointment({ status: 'CONFIRMED' }),
      'psychologist',
      referenceNow
    ).primary).toEqual({
      type: 'transition',
      label: 'Iniciar atención',
      transition: 'START',
    });

    expect(getAppointmentActionPlan(
      appointment({ status: 'IN_PROGRESS' }),
      'psychologist',
      referenceNow
    ).primary).toEqual({
      type: 'transition',
      label: 'Completar atención',
      transition: 'COMPLETE',
    });
  });

  it('evita reprogramar citas vencidas y ofrece registrar la inasistencia', () => {
    const ended = appointment({
      startsAt: '2026-09-01T16:00:00.000Z',
      endsAt: '2026-09-01T17:00:00.000Z',
    });

    expect(getAppointmentActionPlan(ended, 'psychologist', referenceNow)).toEqual({
      primary: { type: 'transition', label: 'Marcar inasistencia', transition: 'NO_SHOW' },
      secondary: [],
    });
    expect(getAppointmentActionPlan(ended, 'patient', referenceNow)).toEqual({
      primary: null,
      secondary: [],
    });
  });

  it('agrupa los horarios según la fecha de la zona horaria de cada slot', () => {
    const slots: AppointmentSlot[] = [
      {
        startsAt: '2026-09-03T04:30:00.000Z',
        endsAt: '2026-09-03T05:30:00.000Z',
        timezone: 'America/Managua',
      },
      {
        startsAt: '2026-09-03T16:00:00.000Z',
        endsAt: '2026-09-03T17:00:00.000Z',
        timezone: 'America/Managua',
      },
    ];

    const groups = groupAppointmentSlots(slots);

    expect(groups).toHaveLength(2);
    expect(groups.map(({ key }) => key)).toEqual(['2026-09-02', '2026-09-03']);
  });

  it('presenta la hora en la zona declarada por la cita', () => {
    const formatted = formatAppointmentDate(
      '2026-09-03T02:00:00.000Z',
      'America/Managua',
      referenceNow
    );

    expect(formatted).toContain('2');
    expect(formatted.toLowerCase()).toContain('sept');
  });
});
