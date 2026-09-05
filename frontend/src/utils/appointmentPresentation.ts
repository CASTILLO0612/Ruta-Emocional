import { APP_LOCALE } from '../config/localization';
import type {
  Appointment,
  AppointmentSlot,
  AppointmentStatus,
  AppointmentTransition,
} from '../repositories/AppointmentRepository';
import type { UserRole } from '../services/AuthService';

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Pendiente',
  CONFIRMED: 'Confirmada',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completada',
  CANCELLED: 'Cancelada',
  NO_SHOW: 'Inasistencia',
};

export type AppointmentAction =
  | { readonly type: 'transition'; readonly label: string; readonly transition: AppointmentTransition }
  | { readonly type: 'reschedule'; readonly label: 'Reprogramar' }
  | { readonly type: 'cancel'; readonly label: 'Cancelar' };

export interface AppointmentActionPlan {
  readonly primary: AppointmentAction | null;
  readonly secondary: readonly AppointmentAction[];
}

function isEnded(appointment: Appointment, now: Date): boolean {
  return new Date(appointment.endsAt).getTime() <= now.getTime();
}

export function getAppointmentActionPlan(
  appointment: Appointment,
  role: UserRole | null,
  now: Date = new Date()
): AppointmentActionPlan {
  const ended = isEnded(appointment, now);
  const canReschedule = !ended
    && (appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED');
  const canCancel = !ended
    && ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'].includes(appointment.status);

  if (role === 'psychologist') {
    let primary: AppointmentAction | null = null;

    if (ended && ['SCHEDULED', 'CONFIRMED'].includes(appointment.status)) {
      primary = { type: 'transition', label: 'Marcar inasistencia', transition: 'NO_SHOW' };
    } else if (appointment.status === 'SCHEDULED') {
      primary = { type: 'transition', label: 'Confirmar cita', transition: 'CONFIRM' };
    } else if (appointment.status === 'CONFIRMED') {
      primary = { type: 'transition', label: 'Iniciar atención', transition: 'START' };
    } else if (appointment.status === 'IN_PROGRESS') {
      primary = { type: 'transition', label: 'Completar atención', transition: 'COMPLETE' };
    }

    const secondary: AppointmentAction[] = [];
    if (canReschedule) secondary.push({ type: 'reschedule', label: 'Reprogramar' });
    if (canCancel) secondary.push({ type: 'cancel', label: 'Cancelar' });
    return { primary, secondary };
  }

  const primary: AppointmentAction | null = canReschedule
    ? { type: 'reschedule', label: 'Reprogramar' }
    : null;
  return {
    primary,
    secondary: canCancel ? [{ type: 'cancel', label: 'Cancelar' }] : [],
  };
}

export function formatAppointmentDate(
  isoDate: string,
  timezone: string,
  now: Date = new Date()
): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';

  try {
    const yearFormatter = new Intl.DateTimeFormat('en', {
      year: 'numeric',
      timeZone: timezone,
    });
    const includesYear = yearFormatter.format(date) !== yearFormatter.format(now);
    return new Intl.DateTimeFormat(APP_LOCALE, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      ...(includesYear ? { year: 'numeric' as const } : {}),
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(APP_LOCALE, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }
}

export function formatAppointmentTimeZone(isoDate: string, timezone: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return timezone;

  try {
    return new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(date).find(({ type }) => type === 'timeZoneName')?.value ?? timezone;
  } catch {
    return timezone;
  }
}

export interface AppointmentSlotGroup {
  readonly key: string;
  readonly label: string;
  readonly slots: readonly AppointmentSlot[];
}

export interface AppointmentSlotDateOption {
  readonly weekday: string;
  readonly date: string;
}

function formatSlotDateParts(slot: AppointmentSlot) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: slot.timezone,
  }).formatToParts(new Date(slot.startsAt));
}

export function groupAppointmentSlots(
  slots: readonly AppointmentSlot[]
): readonly AppointmentSlotGroup[] {
  const groups = new Map<string, AppointmentSlot[]>();

  const chronologicallyOrdered = [...slots].sort((left, right) => (
    new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime()
  ));
  for (const slot of chronologicallyOrdered) {
    let key = slot.startsAt.slice(0, 10);
    try {
      const parts = formatSlotDateParts(slot);
      const part = (type: Intl.DateTimeFormatPartTypes) => (
        parts.find((item) => item.type === type)?.value ?? ''
      );
      key = `${part('year')}-${part('month')}-${part('day')}`;
    } catch {
    }
    const group = groups.get(key) ?? [];
    group.push(slot);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([key, groupedSlots]) => {
    const first = groupedSlots[0];
    let label = key;
    try {
      label = new Intl.DateTimeFormat(APP_LOCALE, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: first.timezone,
      }).format(new Date(first.startsAt));
    } catch {
    }
    return { key, label, slots: groupedSlots };
  });
}

export function formatAppointmentSlotTime(slot: AppointmentSlot): string {
  try {
    return new Intl.DateTimeFormat(APP_LOCALE, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: slot.timezone,
    }).format(new Date(slot.startsAt));
  } catch {
    return new Intl.DateTimeFormat(APP_LOCALE, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(slot.startsAt));
  }
}

export function formatAppointmentSlotDateOption(
  slot: AppointmentSlot
): AppointmentSlotDateOption {
  const instant = new Date(slot.startsAt);
  try {
    const weekday = new Intl.DateTimeFormat(APP_LOCALE, {
      weekday: 'short',
      timeZone: slot.timezone,
    }).format(instant).replace('.', '');
    const date = new Intl.DateTimeFormat(APP_LOCALE, {
      day: 'numeric',
      month: 'short',
      timeZone: slot.timezone,
    }).format(instant).replace('.', '');
    return { weekday, date };
  } catch {
    return { weekday: 'Fecha', date: slot.startsAt.slice(0, 10) };
  }
}
