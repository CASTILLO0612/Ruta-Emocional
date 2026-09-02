export const APPOINTMENT_MODALITIES = ['CHAT', 'CALL', 'IN_PERSON'] as const;
export type AppointmentModality = typeof APPOINTMENT_MODALITIES[number];

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type AppointmentStatusValue = typeof APPOINTMENT_STATUSES[number];

export const APPOINTMENT_TRANSITIONS = [
  'CONFIRM',
  'START',
  'COMPLETE',
  'CANCEL',
  'NO_SHOW',
] as const;
export type AppointmentTransition = typeof APPOINTMENT_TRANSITIONS[number];

export interface AppointmentCounterpart {
  readonly userId: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
}

export interface AppointmentRelationshipView {
  readonly id: string;
  readonly counterpart: AppointmentCounterpart;
  readonly enabledModalities: readonly AppointmentModality[];
  readonly timezone: string | null;
  readonly conversationId: string | null;
}

export interface AvailableAppointmentSlot {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
}

export interface AppointmentView {
  readonly id: string;
  readonly careRelationshipId: string;
  readonly counterpart: AppointmentCounterpart;
  readonly modality: AppointmentModality;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  readonly status: AppointmentStatusValue;
  readonly cancellationReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppointmentCursor {
  readonly startsAt: Date;
  readonly id: string;
}

export interface AppointmentPageQuery {
  readonly scope: 'UPCOMING' | 'HISTORY';
  readonly limit: number;
  readonly cursor?: AppointmentCursor;
}

export interface AppointmentPage {
  readonly items: readonly AppointmentView[];
  readonly nextCursor: string | null;
}

export function encodeAppointmentCursor(cursor: AppointmentCursor): string {
  return Buffer.from(JSON.stringify({
    startsAt: cursor.startsAt.toISOString(),
    id: cursor.id,
  }), 'utf8').toString('base64url');
}
