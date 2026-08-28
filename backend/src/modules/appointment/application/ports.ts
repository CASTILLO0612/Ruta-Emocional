import { createHash } from 'crypto';
import { AppConfig } from '../../../config/env';
import {
  AppointmentModality,
  AppointmentPage,
  AppointmentPageQuery,
  AppointmentRelationshipView,
  AppointmentTransition,
  AppointmentView,
  AvailableAppointmentSlot,
} from '../domain/appointmentTypes';

export interface AppointmentAuditContext {
  readonly actorUserId: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface AppointmentIdempotency {
  readonly key: string;
  readonly requestHash: string;
  readonly now: Date;
  readonly expiresAt: Date;
}

export interface CreateAppointmentCommand {
  readonly careRelationshipId: string;
  readonly modality: AppointmentModality;
  readonly startsAt: Date;
}

export interface AppointmentRepository {
  listRelationships(userId: string): Promise<readonly AppointmentRelationshipView[]>;
  listAvailableSlots(
    userId: string,
    careRelationshipId: string,
    modality: AppointmentModality,
    from: Date,
    until: Date,
    policy: AppConfig['appointments']
  ): Promise<readonly AvailableAppointmentSlot[]>;
  create(
    userId: string,
    command: CreateAppointmentCommand,
    idempotency: AppointmentIdempotency,
    policy: AppConfig['appointments'],
    audit: AppointmentAuditContext
  ): Promise<AppointmentView>;
  list(
    userId: string,
    query: AppointmentPageQuery,
    now: Date
  ): Promise<AppointmentPage>;
  transition(
    userId: string,
    appointmentId: string,
    transition: AppointmentTransition,
    reason: string | undefined,
    idempotency: AppointmentIdempotency,
    policy: AppConfig['appointments'],
    audit: AppointmentAuditContext
  ): Promise<AppointmentView>;
  reschedule(
    userId: string,
    appointmentId: string,
    startsAt: Date,
    idempotency: AppointmentIdempotency,
    policy: AppConfig['appointments'],
    audit: AppointmentAuditContext
  ): Promise<AppointmentView>;
}

export function hashAppointmentPayload(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input), 'utf8').digest('hex');
}
