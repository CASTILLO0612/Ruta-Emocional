import { apiV1Request } from '../services/apiClient';

export type AppointmentModality = 'CHAT' | 'CALL' | 'IN_PERSON';
export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';
export type AppointmentTransition = 'CONFIRM' | 'START' | 'COMPLETE' | 'CANCEL' | 'NO_SHOW';

export interface AppointmentRelationship {
  readonly id: string;
  readonly counterpart: {
    readonly userId: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
  };
  readonly enabledModalities: readonly AppointmentModality[];
  readonly timezone: string | null;
  readonly conversationId: string | null;
}

export interface AppointmentSlot {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
}

export interface Appointment {
  readonly id: string;
  readonly careRelationshipId: string;
  readonly counterpart: AppointmentRelationship['counterpart'];
  readonly modality: AppointmentModality;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  readonly status: AppointmentStatus;
  readonly cancellationReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppointmentPolicy {
  readonly durationMinutes: number;
  readonly slotIntervalMinutes: number;
  readonly minimumLeadMinutes: number;
  readonly maximumHorizonDays: number;
  readonly patientCancellationNoticeMinutes: number;
}

interface Envelope<T> { readonly data: T }
interface PageEnvelope<T> {
  readonly data: readonly T[];
  readonly meta: { readonly nextCursor: string | null };
}

function queryString(parameters: Record<string, string | number | undefined>): string {
  const query = Object.entries(parameters)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `?${query}` : '';
}

export async function fetchAppointmentPolicy(signal?: AbortSignal): Promise<AppointmentPolicy> {
  return (await apiV1Request<Envelope<AppointmentPolicy>>(
    '/appointments/policy',
    'GET',
    undefined,
    { signal }
  )).data;
}

export async function fetchAppointmentRelationships(
  signal?: AbortSignal
): Promise<readonly AppointmentRelationship[]> {
  return (await apiV1Request<Envelope<readonly AppointmentRelationship[]>>(
    '/appointment-relationships',
    'GET',
    undefined,
    { signal }
  )).data;
}

export async function fetchAppointmentSlots(input: {
  readonly careRelationshipId: string;
  readonly modality: AppointmentModality;
  readonly from: Date;
  readonly until: Date;
  readonly signal?: AbortSignal;
}): Promise<readonly AppointmentSlot[]> {
  return (await apiV1Request<Envelope<readonly AppointmentSlot[]>>(
    `/appointment-slots${queryString({
      careRelationshipId: input.careRelationshipId,
      modality: input.modality,
      from: input.from.toISOString(),
      until: input.until.toISOString(),
    })}`,
    'GET',
    undefined,
    { signal: input.signal }
  )).data;
}

export async function fetchAppointments(
  scope: 'UPCOMING' | 'HISTORY',
  cursor?: string,
  signal?: AbortSignal
): Promise<PageEnvelope<Appointment>> {
  return apiV1Request<PageEnvelope<Appointment>>(
    `/appointments${queryString({ scope, cursor })}`,
    'GET',
    undefined,
    { signal }
  );
}

export async function createAppointment(
  input: {
    readonly careRelationshipId: string;
    readonly modality: AppointmentModality;
    readonly startsAt: string;
  },
  idempotencyKey: string
): Promise<Appointment> {
  return (await apiV1Request<Envelope<Appointment>>(
    '/appointments',
    'POST',
    input,
    { idempotencyKey }
  )).data;
}

export async function transitionAppointment(
  appointmentId: string,
  transition: AppointmentTransition,
  idempotencyKey: string,
  reason?: string
): Promise<Appointment> {
  return (await apiV1Request<Envelope<Appointment>>(
    `/appointments/${encodeURIComponent(appointmentId)}/transitions`,
    'POST',
    { transition, ...(reason ? { reason } : {}) },
    { idempotencyKey }
  )).data;
}

export async function rescheduleAppointment(
  appointmentId: string,
  startsAt: string,
  idempotencyKey: string
): Promise<Appointment> {
  return (await apiV1Request<Envelope<Appointment>>(
    `/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
    'POST',
    { startsAt },
    { idempotencyKey }
  )).data;
}
