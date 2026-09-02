import { AppConfig } from '../../../config/env';
import { Clock } from '../../../shared/application/clock';
import { AppError } from '../../../shared/domain/appError';
import { AuthenticatedActor } from '../../identity/application/identityService';
import {
  AppointmentAuditContext,
  AppointmentRepository,
  CreateAppointmentCommand,
  hashAppointmentPayload,
} from './ports';
import {
  AppointmentModality,
  AppointmentPageQuery,
  AppointmentTransition,
} from '../domain/appointmentTypes';

export class AppointmentService {
  constructor(
    private readonly repository: AppointmentRepository,
    private readonly clock: Clock,
    private readonly policy: AppConfig['appointments']
  ) {}

  getPolicy() {
    return {
      durationMinutes: this.policy.durationMinutes,
      slotIntervalMinutes: this.policy.slotIntervalMinutes,
      minimumLeadMinutes: this.policy.minimumLeadMinutes,
      maximumHorizonDays: this.policy.maximumHorizonDays,
      patientCancellationNoticeMinutes: this.policy.patientCancellationNoticeMinutes,
    };
  }

  listRelationships(actor: AuthenticatedActor) {
    this.assertAgendaAccess(actor);
    return this.repository.listRelationships(actor.user.id);
  }

  listAvailableSlots(
    actor: AuthenticatedActor,
    careRelationshipId: string,
    modality: AppointmentModality,
    from: Date,
    until: Date
  ) {
    this.assertAgendaAccess(actor);
    const now = this.clock.now();
    const earliest = new Date(now.getTime() + this.policy.minimumLeadMinutes * 60_000);
    const latest = new Date(now.getTime() + this.policy.maximumHorizonDays * 86_400_000);
    if (from < earliest || until <= from || until > latest) {
      throw AppError.validation([{
        field: 'from',
        code: 'APPOINTMENT_WINDOW_OUT_OF_RANGE',
        message: 'La ventana solicitada está fuera del rango permitido.',
      }]);
    }
    return this.repository.listAvailableSlots(
      actor.user.id,
      careRelationshipId,
      modality,
      from,
      until,
      this.policy
    );
  }

  create(
    actor: AuthenticatedActor,
    command: CreateAppointmentCommand,
    idempotencyKey: string,
    audit: AppointmentAuditContext
  ) {
    this.assertCapability(actor, 'appointment:create:self');
    const now = this.clock.now();
    this.assertStartWithinBookingWindow(command.startsAt, now);
    return this.repository.create(
      actor.user.id,
      command,
      this.idempotency(idempotencyKey, hashAppointmentPayload(command), now),
      this.policy,
      audit
    );
  }

  list(actor: AuthenticatedActor, query: AppointmentPageQuery) {
    this.assertAgendaAccess(actor);
    return this.repository.list(actor.user.id, query, this.clock.now());
  }

  transition(
    actor: AuthenticatedActor,
    appointmentId: string,
    transition: AppointmentTransition,
    reason: string | undefined,
    idempotencyKey: string,
    audit: AppointmentAuditContext
  ) {
    this.assertAgendaAccess(actor);
    const now = this.clock.now();
    return this.repository.transition(
      actor.user.id,
      appointmentId,
      transition,
      reason,
      this.idempotency(
        idempotencyKey,
        hashAppointmentPayload({ appointmentId, transition, reason: reason ?? null }),
        now
      ),
      this.policy,
      audit
    );
  }

  reschedule(
    actor: AuthenticatedActor,
    appointmentId: string,
    startsAt: Date,
    idempotencyKey: string,
    audit: AppointmentAuditContext
  ) {
    this.assertAgendaAccess(actor);
    const now = this.clock.now();
    this.assertStartWithinBookingWindow(startsAt, now);
    return this.repository.reschedule(
      actor.user.id,
      appointmentId,
      startsAt,
      this.idempotency(
        idempotencyKey,
        hashAppointmentPayload({ appointmentId, startsAt }),
        now
      ),
      this.policy,
      audit
    );
  }

  private assertStartWithinBookingWindow(startsAt: Date, now: Date): void {
    const earliest = now.getTime() + this.policy.minimumLeadMinutes * 60_000;
    const latest = now.getTime() + this.policy.maximumHorizonDays * 86_400_000;
    if (startsAt.getTime() < earliest || startsAt.getTime() > latest) {
      throw AppError.validation([{
        field: 'startsAt',
        code: 'APPOINTMENT_START_OUT_OF_RANGE',
        message: 'La fecha de la cita está fuera de la ventana permitida.',
      }]);
    }
  }

  private idempotency(key: string, requestHash: string, now: Date) {
    return {
      key,
      requestHash,
      now,
      expiresAt: new Date(now.getTime() + this.policy.idempotencyTtlHours * 3_600_000),
    };
  }

  private assertAgendaAccess(actor: AuthenticatedActor): void {
    if (
      !actor.user.capabilities.includes('appointment:read:self')
      && !actor.user.capabilities.includes('appointment:manage:self')
    ) {
      throw AppError.forbidden('CAPABILITY_REQUIRED');
    }
  }

  private assertCapability(actor: AuthenticatedActor, capability: string): void {
    if (!actor.user.capabilities.includes(capability)) {
      throw AppError.forbidden('CAPABILITY_REQUIRED');
    }
  }
}
