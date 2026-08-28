import {
  AccountStatus,
  AppointmentEventType,
  AppointmentStatus,
  CareRelationshipStatus,
  Modality,
  Prisma,
  PrismaClient,
  VerificationStatus,
} from '../../../../generated/prisma/client';
import { AppConfig } from '../../../../config/env';
import { AppError } from '../../../../shared/domain/appError';
import {
  AppointmentAuditContext,
  AppointmentIdempotency,
  AppointmentRepository,
  CreateAppointmentCommand,
} from '../../application/ports';
import {
  AppointmentModality,
  AppointmentPage,
  AppointmentPageQuery,
  AppointmentRelationshipView,
  AppointmentTransition,
  AppointmentView,
  AvailableAppointmentSlot,
  encodeAppointmentCursor,
} from '../../domain/appointmentTypes';

const CREATE_OPERATION = 'appointment.create';
const RESCHEDULE_OPERATION = 'appointment.reschedule';
const ACTIVE_STATUSES: readonly AppointmentStatus[] = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.IN_PROGRESS,
];

const appointmentInclude = {
  careRelationshipLink: {
    include: {
      careRelationship: {
        include: {
          patientProfile: { include: { user: true } },
          psychologistProfile: { include: { user: true } },
        },
      },
    },
  },
} satisfies Prisma.AppointmentInclude;

type AppointmentRow = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

interface SlotRow {
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
}

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  if (error.code !== 'P2010' || typeof error.meta !== 'object' || error.meta === null) return false;
  const metadata = error.meta as Record<string, unknown>;
  return metadata.code === '40001'
    || (typeof metadata.database_error === 'string' && metadata.database_error.includes('40001'));
}

function isOverlapConstraint(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const metadata = typeof error.meta === 'object' && error.meta !== null
    ? JSON.stringify(error.meta)
    : '';
  return error.code === 'P2004'
    || metadata.includes('appointments_psychologist_no_overlap')
    || metadata.includes('appointments_patient_no_overlap')
    || metadata.includes('23P01');
}

export class PrismaAppointmentRepository implements AppointmentRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly retryPolicy: { readonly maximumRetries: number; readonly baseDelayMs: number }
  ) {}

  async listRelationships(userId: string): Promise<readonly AppointmentRelationshipView[]> {
    const relationships = await this.prisma.careRelationship.findMany({
      where: {
        status: CareRelationshipStatus.ACTIVE,
        OR: [
          { patientProfile: { userId } },
          { psychologistProfile: { userId } },
        ],
        psychologistProfile: {
          verificationStatus: VerificationStatus.VERIFIED,
          user: { status: AccountStatus.ACTIVE },
        },
      },
      include: {
        patientProfile: { include: { user: true } },
        psychologistProfile: {
          include: {
            user: true,
            modalities: { where: { isEnabled: true }, orderBy: { modality: 'asc' } },
            availabilityRules: {
              where: { isActive: true },
              orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
              take: 1,
            },
          },
        },
        source: {
          include: {
            serviceRequest: { include: { conversationLink: true } },
          },
        },
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    });

    return relationships.map((relationship) => {
      const patientActor = relationship.patientProfile.userId === userId;
      const counterpart = patientActor
        ? relationship.psychologistProfile.user
        : relationship.patientProfile.user;
      return {
        id: relationship.id,
        counterpart: {
          userId: counterpart.id,
          displayName: counterpart.displayName,
          photoUrl: counterpart.photoUrl,
        },
        enabledModalities: relationship.psychologistProfile.modalities
          .map(({ modality }) => modality as AppointmentModality),
        timezone: relationship.psychologistProfile.availabilityRules[0]?.timezone ?? null,
        conversationId:
          relationship.source?.serviceRequest.conversationLink?.conversationId ?? null,
      };
    });
  }

  async listAvailableSlots(
    userId: string,
    careRelationshipId: string,
    modality: AppointmentModality,
    from: Date,
    until: Date,
    policy: AppConfig['appointments']
  ): Promise<readonly AvailableAppointmentSlot[]> {
    await this.requireRelationship(this.prisma, userId, careRelationshipId, modality);
    const slots = await this.availableSlots(
      this.prisma,
      careRelationshipId,
      modality,
      from,
      until,
      policy
    );
    return slots.map((slot) => ({
      startsAt: slot.startsAt.toISOString(),
      endsAt: slot.endsAt.toISOString(),
      timezone: slot.timezone,
    }));
  }

  async create(
    userId: string,
    command: CreateAppointmentCommand,
    idempotency: AppointmentIdempotency,
    policy: AppConfig['appointments'],
    audit: AppointmentAuditContext
  ): Promise<AppointmentView> {
    try {
      return await this.withSerializableRetry(async (transaction) => {
        await this.lockOperation(transaction, userId, CREATE_OPERATION, idempotency.key);
        const replay = await this.findIdempotentResource(
          transaction,
          userId,
          CREATE_OPERATION,
          idempotency
        );
        if (replay) return this.findAppointmentForActor(transaction, userId, replay);

        const relationship = await this.requireRelationship(
          transaction,
          userId,
          command.careRelationshipId,
          command.modality
        );
        const endsAt = new Date(command.startsAt.getTime() + policy.durationMinutes * 60_000);
        const available = await this.availableSlots(
          transaction,
          command.careRelationshipId,
          command.modality,
          command.startsAt,
          endsAt,
          policy
        );
        const selected = available.find((slot) => slot.startsAt.getTime() === command.startsAt.getTime());
        if (!selected) {
          throw AppError.conflict(
            'APPOINTMENT_SLOT_UNAVAILABLE',
            'El horario ya no está disponible. Actualiza la agenda e intenta nuevamente.'
          );
        }

        const created = await transaction.appointment.create({
          data: {
            patientProfileId: relationship.patientProfileId,
            psychologistProfileId: relationship.psychologistProfileId,
            modality: command.modality as Modality,
            startsAt: command.startsAt,
            endsAt,
            timezone: selected.timezone,
            careRelationshipLink: {
              create: { careRelationshipId: command.careRelationshipId },
            },
          },
          include: appointmentInclude,
        });
        await transaction.appointmentEvent.create({
          data: {
            appointmentId: created.id,
            actorUserId: userId,
            type: AppointmentEventType.CREATED,
            toStatus: AppointmentStatus.SCHEDULED,
          },
        });
        await this.recordIdempotency(transaction, userId, CREATE_OPERATION, idempotency, created.id);
        await this.writeAudit(transaction, audit, 'appointment.created', created.id, {
          careRelationshipId: command.careRelationshipId,
          modality: created.modality,
        });
        await this.writeOutbox(
          transaction,
          created,
          'appointment.created',
          relationship.patientUserId,
          relationship.psychologistUserId
        );
        await this.writeReminders(
          transaction,
          created,
          relationship.patientUserId,
          relationship.psychologistUserId,
          idempotency.now,
          policy
        );
        return this.toView(created, userId);
      });
    } catch (error) {
      if (isOverlapConstraint(error)) {
        throw AppError.conflict(
          'APPOINTMENT_SLOT_UNAVAILABLE',
          'El horario ya fue reservado por otra operación.'
        );
      }
      throw error;
    }
  }

  async list(
    userId: string,
    query: AppointmentPageQuery,
    now: Date
  ): Promise<AppointmentPage> {
    const ascending = query.scope === 'UPCOMING';
    const rows = await this.prisma.appointment.findMany({
      where: {
        AND: [
          {
            OR: [
              { patientProfile: { userId } },
              { psychologistProfile: { userId } },
            ],
          },
          ascending
            ? { status: { in: [...ACTIVE_STATUSES] }, endsAt: { gt: now } }
            : {
                OR: [
                  {
                    status: {
                      in: [
                        AppointmentStatus.COMPLETED,
                        AppointmentStatus.CANCELLED,
                        AppointmentStatus.NO_SHOW,
                      ],
                    },
                  },
                  { endsAt: { lte: now } },
                ],
              },
          ...(query.cursor
            ? [{
                OR: ascending
                  ? [
                      { startsAt: { gt: query.cursor.startsAt } },
                      { startsAt: query.cursor.startsAt, id: { gt: query.cursor.id } },
                    ]
                  : [
                      { startsAt: { lt: query.cursor.startsAt } },
                      { startsAt: query.cursor.startsAt, id: { lt: query.cursor.id } },
                    ],
              }]
            : []),
        ],
      },
      include: appointmentInclude,
      orderBy: [{ startsAt: ascending ? 'asc' : 'desc' }, { id: ascending ? 'asc' : 'desc' }],
      take: query.limit + 1,
    });
    const hasNext = rows.length > query.limit;
    const pageRows = hasNext ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => this.toView(row, userId)),
      nextCursor: hasNext && last
        ? encodeAppointmentCursor({ startsAt: last.startsAt, id: last.id })
        : null,
    };
  }

  async transition(
    userId: string,
    appointmentId: string,
    transition: AppointmentTransition,
    reason: string | undefined,
    idempotency: AppointmentIdempotency,
    policy: AppConfig['appointments'],
    audit: AppointmentAuditContext
  ): Promise<AppointmentView> {
    const operation = `appointment.transition.${transition.toLowerCase()}`;
    return this.withSerializableRetry(async (transaction) => {
      await this.lockOperation(transaction, userId, operation, idempotency.key);
      const replay = await this.findIdempotentResource(
        transaction,
        userId,
        operation,
        idempotency
      );
      if (replay) return this.findAppointmentForActor(transaction, userId, replay);

      await this.lockAppointment(transaction, appointmentId);
      const current = await this.findAppointmentRow(transaction, userId, appointmentId);
      const relationship = current.careRelationshipLink!.careRelationship;
      const isPatient = relationship.patientProfile.userId === userId;
      const isPsychologist = relationship.psychologistProfile.userId === userId;
      const nextStatus = this.resolveTransition(
        current,
        transition,
        reason,
        isPatient,
        isPsychologist,
        idempotency.now,
        policy
      );

      const updated = await transaction.appointment.update({
        where: { id: appointmentId },
        data: {
          status: nextStatus,
          ...(nextStatus === AppointmentStatus.CANCELLED ? { cancellationReason: reason } : {}),
        },
        include: appointmentInclude,
      });
      await transaction.appointmentEvent.create({
        data: {
          appointmentId,
          actorUserId: userId,
          type: AppointmentEventType.STATUS_CHANGED,
          fromStatus: current.status,
          toStatus: nextStatus,
          reason,
        },
      });
      await this.recordIdempotency(transaction, userId, operation, idempotency, appointmentId);
      await this.writeAudit(transaction, audit, `appointment.${transition.toLowerCase()}`, appointmentId, {
        fromStatus: current.status,
        toStatus: nextStatus,
      });
      await this.writeOutbox(
        transaction,
        updated,
        'appointment.updated',
        relationship.patientProfile.userId,
        relationship.psychologistProfile.userId
      );
      return this.toView(updated, userId);
    });
  }

  async reschedule(
    userId: string,
    appointmentId: string,
    startsAt: Date,
    idempotency: AppointmentIdempotency,
    policy: AppConfig['appointments'],
    audit: AppointmentAuditContext
  ): Promise<AppointmentView> {
    try {
      return await this.withSerializableRetry(async (transaction) => {
        await this.lockOperation(transaction, userId, RESCHEDULE_OPERATION, idempotency.key);
        const replay = await this.findIdempotentResource(
          transaction,
          userId,
          RESCHEDULE_OPERATION,
          idempotency
        );
        if (replay) return this.findAppointmentForActor(transaction, userId, replay);

        await this.lockAppointment(transaction, appointmentId);
        const current = await this.findAppointmentRow(transaction, userId, appointmentId);
        if (
          current.status !== AppointmentStatus.SCHEDULED
          && current.status !== AppointmentStatus.CONFIRMED
        ) {
          throw AppError.conflict('APPOINTMENT_NOT_RESCHEDULABLE', 'La cita ya no puede reprogramarse.');
        }
        const relationship = current.careRelationshipLink!.careRelationship;
        const isPatient = relationship.patientProfile.userId === userId;
        if (
          isPatient
          && idempotency.now.getTime()
            > current.startsAt.getTime() - policy.patientCancellationNoticeMinutes * 60_000
        ) {
          throw AppError.conflict(
            'APPOINTMENT_NOTICE_REQUIRED',
            'La cita ya está dentro de la ventana mínima de anticipación.'
          );
        }
        const endsAt = new Date(startsAt.getTime() + policy.durationMinutes * 60_000);
        const slots = await this.availableSlots(
          transaction,
          relationship.id,
          current.modality as AppointmentModality,
          startsAt,
          endsAt,
          policy,
          appointmentId
        );
        const selected = slots.find((slot) => slot.startsAt.getTime() === startsAt.getTime());
        if (!selected) {
          throw AppError.conflict('APPOINTMENT_SLOT_UNAVAILABLE', 'El nuevo horario no está disponible.');
        }

        const updated = await transaction.appointment.update({
          where: { id: appointmentId },
          data: {
            startsAt,
            endsAt,
            timezone: selected.timezone,
            status: AppointmentStatus.SCHEDULED,
            cancellationReason: null,
          },
          include: appointmentInclude,
        });
        await transaction.appointmentEvent.create({
          data: {
            appointmentId,
            actorUserId: userId,
            type: AppointmentEventType.RESCHEDULED,
            fromStatus: current.status,
            toStatus: AppointmentStatus.SCHEDULED,
            previousStartsAt: current.startsAt,
            previousEndsAt: current.endsAt,
          },
        });
        await this.recordIdempotency(transaction, userId, RESCHEDULE_OPERATION, idempotency, appointmentId);
        await this.writeAudit(transaction, audit, 'appointment.rescheduled', appointmentId, {
          fromStartsAt: current.startsAt.toISOString(),
          toStartsAt: startsAt.toISOString(),
        });
        await this.writeOutbox(
          transaction,
          updated,
          'appointment.rescheduled',
          relationship.patientProfile.userId,
          relationship.psychologistProfile.userId
        );
        await this.writeReminders(
          transaction,
          updated,
          relationship.patientProfile.userId,
          relationship.psychologistProfile.userId,
          idempotency.now,
          policy
        );
        return this.toView(updated, userId);
      });
    } catch (error) {
      if (isOverlapConstraint(error)) {
        throw AppError.conflict('APPOINTMENT_SLOT_UNAVAILABLE', 'El nuevo horario ya fue reservado.');
      }
      throw error;
    }
  }

  private async availableSlots(
    client: DatabaseClient,
    careRelationshipId: string,
    modality: AppointmentModality,
    from: Date,
    until: Date,
    policy: AppConfig['appointments'],
    excludedAppointmentId?: string
  ): Promise<readonly SlotRow[]> {
    const excluded = excludedAppointmentId
      ? Prisma.sql`AND appointment."id" <> ${excludedAppointmentId}::uuid`
      : Prisma.empty;
    return client.$queryRaw<SlotRow[]>(Prisma.sql`
      WITH context AS (
        SELECT relationship."psychologist_profile_id" AS psychologist_id,
               relationship."patient_profile_id" AS patient_id,
               timezone_source."timezone"
          FROM "care_relationships" relationship
          JOIN LATERAL (
            SELECT rule."timezone"
              FROM "availability_rules" rule
             WHERE rule."psychologist_profile_id" = relationship."psychologist_profile_id"
               AND rule."is_active" = true
             ORDER BY rule."weekday", rule."start_time", rule."id"
             LIMIT 1
          ) timezone_source ON true
         WHERE relationship."id" = ${careRelationshipId}::uuid
           AND relationship."status" = 'ACTIVE'
           AND EXISTS (
             SELECT 1
               FROM "psychologist_modalities" enabled_modality
              WHERE enabled_modality."psychologist_profile_id" = relationship."psychologist_profile_id"
                AND enabled_modality."modality" = ${modality}::"modality"
                AND enabled_modality."is_enabled" = true
           )
      ), days AS (
        SELECT context."psychologist_id", context."patient_id", context."timezone", day_value::date AS local_day
          FROM context
          CROSS JOIN LATERAL generate_series(
            ((${from} AT TIME ZONE context."timezone")::date - 1),
            ((${until} AT TIME ZONE context."timezone")::date + 1),
            interval '1 day'
          ) day_value
      ), windows AS (
        SELECT days."psychologist_id", days."patient_id", rule."timezone",
               (days.local_day + rule."start_time") AT TIME ZONE rule."timezone" AS starts_at,
               (days.local_day + rule."end_time") AT TIME ZONE rule."timezone" AS ends_at
          FROM days
          JOIN "availability_rules" rule
            ON rule."psychologist_profile_id" = days."psychologist_id"
           AND rule."timezone" = days."timezone"
           AND rule."is_active" = true
           AND rule."weekday" = EXTRACT(DOW FROM days.local_day)::smallint
           AND (rule."effective_from" IS NULL OR rule."effective_from" <= days.local_day)
           AND (rule."effective_until" IS NULL OR rule."effective_until" >= days.local_day)
        UNION ALL
        SELECT exception."psychologist_profile_id", context."patient_id", context."timezone",
               exception."starts_at", exception."ends_at"
          FROM context
          JOIN "availability_exceptions" exception
            ON exception."psychologist_profile_id" = context."psychologist_id"
           AND exception."type" = 'AVAILABLE'
           AND exception."ends_at" > ${from}
           AND exception."starts_at" < ${until}
      ), candidates AS (
        SELECT windows."psychologist_id", windows."patient_id", windows."timezone", slot_start
          FROM windows
          CROSS JOIN LATERAL generate_series(
            windows.starts_at,
            windows.ends_at - make_interval(mins => ${policy.durationMinutes}::int),
            make_interval(mins => ${policy.slotIntervalMinutes}::int)
          ) slot_start
         WHERE windows.ends_at - windows.starts_at >= make_interval(mins => ${policy.durationMinutes}::int)
      )
      SELECT DISTINCT candidates.slot_start AS "startsAt",
             candidates.slot_start + make_interval(mins => ${policy.durationMinutes}::int) AS "endsAt",
             candidates."timezone"
        FROM candidates
       WHERE candidates.slot_start >= ${from}
         AND candidates.slot_start + make_interval(mins => ${policy.durationMinutes}::int) <= ${until}
         AND NOT EXISTS (
           SELECT 1
             FROM "availability_exceptions" exception
            WHERE exception."psychologist_profile_id" = candidates."psychologist_id"
              AND exception."type" = 'UNAVAILABLE'
              AND tstzrange(exception."starts_at", exception."ends_at", '[)')
                  && tstzrange(
                    candidates.slot_start,
                    candidates.slot_start + make_interval(mins => ${policy.durationMinutes}::int),
                    '[)'
                  )
         )
         AND NOT EXISTS (
           SELECT 1
             FROM "appointments" appointment
            WHERE (
                    appointment."psychologist_profile_id" = candidates."psychologist_id"
                    OR appointment."patient_profile_id" = candidates."patient_id"
                  )
              AND appointment."status" IN ('SCHEDULED', 'CONFIRMED', 'IN_PROGRESS')
              ${excluded}
              AND tstzrange(appointment."starts_at", appointment."ends_at", '[)')
                  && tstzrange(
                    candidates.slot_start,
                    candidates.slot_start + make_interval(mins => ${policy.durationMinutes}::int),
                    '[)'
                  )
         )
       ORDER BY "startsAt"
       LIMIT 200
    `);
  }

  private async requireRelationship(
    client: DatabaseClient,
    userId: string,
    careRelationshipId: string,
    modality: AppointmentModality
  ) {
    const relationship = await client.careRelationship.findFirst({
      where: {
        id: careRelationshipId,
        status: CareRelationshipStatus.ACTIVE,
        OR: [
          { patientProfile: { userId } },
          { psychologistProfile: { userId } },
        ],
        psychologistProfile: {
          verificationStatus: VerificationStatus.VERIFIED,
          user: { status: AccountStatus.ACTIVE },
          modalities: { some: { modality: modality as Modality, isEnabled: true } },
        },
      },
      select: {
        id: true,
        patientProfileId: true,
        psychologistProfileId: true,
        patientProfile: { select: { userId: true } },
        psychologistProfile: { select: { userId: true } },
      },
    });
    if (!relationship) throw AppError.notFound('CARE_RELATIONSHIP_NOT_FOUND');
    return {
      ...relationship,
      patientUserId: relationship.patientProfile.userId,
      psychologistUserId: relationship.psychologistProfile.userId,
    };
  }

  private resolveTransition(
    appointment: AppointmentRow,
    transition: AppointmentTransition,
    reason: string | undefined,
    isPatient: boolean,
    isPsychologist: boolean,
    now: Date,
    policy: AppConfig['appointments']
  ): AppointmentStatus {
    if (transition === 'CONFIRM') {
      if (!isPsychologist || appointment.status !== AppointmentStatus.SCHEDULED) {
        throw AppError.conflict('APPOINTMENT_TRANSITION_NOT_ALLOWED', 'La cita no puede confirmarse.');
      }
      return AppointmentStatus.CONFIRMED;
    }
    if (transition === 'START') {
      const earliest = appointment.startsAt.getTime() - policy.startWindowBeforeMinutes * 60_000;
      if (
        !isPsychologist
        || appointment.status !== AppointmentStatus.CONFIRMED
        || now.getTime() < earliest
        || now >= appointment.endsAt
      ) {
        throw AppError.conflict('APPOINTMENT_TRANSITION_NOT_ALLOWED', 'La cita no puede iniciarse ahora.');
      }
      return AppointmentStatus.IN_PROGRESS;
    }
    if (transition === 'COMPLETE') {
      if (!isPsychologist || appointment.status !== AppointmentStatus.IN_PROGRESS) {
        throw AppError.conflict('APPOINTMENT_TRANSITION_NOT_ALLOWED', 'La cita no puede completarse.');
      }
      return AppointmentStatus.COMPLETED;
    }
    if (transition === 'NO_SHOW') {
      if (
        !isPsychologist
        || (
          appointment.status !== AppointmentStatus.SCHEDULED
          && appointment.status !== AppointmentStatus.CONFIRMED
        )
        || now < appointment.endsAt
      ) {
        throw AppError.conflict('APPOINTMENT_TRANSITION_NOT_ALLOWED', 'No es posible marcar inasistencia.');
      }
      return AppointmentStatus.NO_SHOW;
    }
    if (!isPatient && !isPsychologist) throw AppError.notFound('APPOINTMENT_NOT_FOUND');
    if (!ACTIVE_STATUSES.includes(appointment.status)) {
      throw AppError.conflict('APPOINTMENT_TRANSITION_NOT_ALLOWED', 'La cita ya no puede cancelarse.');
    }
    if (!reason) {
      throw AppError.validation([{
        field: 'reason',
        code: 'CANCELLATION_REASON_REQUIRED',
        message: 'Indica el motivo de cancelación.',
      }]);
    }
    if (
      isPatient
      && now.getTime() > appointment.startsAt.getTime() - policy.patientCancellationNoticeMinutes * 60_000
    ) {
      throw AppError.conflict(
        'APPOINTMENT_NOTICE_REQUIRED',
        'La cita ya está dentro de la ventana mínima de cancelación.'
      );
    }
    return AppointmentStatus.CANCELLED;
  }

  private async findAppointmentRow(
    client: DatabaseClient,
    userId: string,
    appointmentId: string
  ): Promise<AppointmentRow> {
    const appointment = await client.appointment.findFirst({
      where: {
        id: appointmentId,
        careRelationshipLink: {
          careRelationship: {
            OR: [
              { patientProfile: { userId } },
              { psychologistProfile: { userId } },
            ],
          },
        },
      },
      include: appointmentInclude,
    });
    if (!appointment?.careRelationshipLink) throw AppError.notFound('APPOINTMENT_NOT_FOUND');
    return appointment;
  }

  private async findAppointmentForActor(
    client: DatabaseClient,
    userId: string,
    appointmentId: string
  ): Promise<AppointmentView> {
    return this.toView(await this.findAppointmentRow(client, userId, appointmentId), userId);
  }

  private toView(row: AppointmentRow, userId: string): AppointmentView {
    const relationship = row.careRelationshipLink?.careRelationship;
    if (!relationship) throw new Error('Appointment is missing its care relationship');
    const patientActor = relationship.patientProfile.userId === userId;
    const counterpart = patientActor
      ? relationship.psychologistProfile.user
      : relationship.patientProfile.user;
    return {
      id: row.id,
      careRelationshipId: relationship.id,
      counterpart: {
        userId: counterpart.id,
        displayName: counterpart.displayName,
        photoUrl: counterpart.photoUrl,
      },
      modality: row.modality as AppointmentModality,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      timezone: row.timezone,
      status: row.status,
      cancellationReason: row.cancellationReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async withSerializableRetry<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!isSerializationConflict(error) || attempt >= this.retryPolicy.maximumRetries) throw error;
        const delay = this.retryPolicy.baseDelayMs * (2 ** attempt);
        const jitter = Math.floor(Math.random() * this.retryPolicy.baseDelayMs);
        await new Promise<void>((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
  }

  private lockAppointment(transaction: Prisma.TransactionClient, appointmentId: string) {
    return transaction.$queryRaw(Prisma.sql`
      SELECT "id" FROM "appointments" WHERE "id" = ${appointmentId}::uuid FOR UPDATE
    `);
  }

  private lockOperation(
    transaction: Prisma.TransactionClient,
    userId: string,
    operation: string,
    key: string
  ) {
    return transaction.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${operation}:${key}`}, 0))
    `);
  }

  private async findIdempotentResource(
    transaction: Prisma.TransactionClient,
    userId: string,
    operation: string,
    idempotency: AppointmentIdempotency
  ): Promise<string | null> {
    const existing = await transaction.idempotencyRecord.findUnique({
      where: {
        actorUserId_operation_idempotencyKey: {
          actorUserId: userId,
          operation,
          idempotencyKey: idempotency.key,
        },
      },
    });
    if (!existing) return null;
    if (existing.expiresAt <= idempotency.now) {
      await transaction.idempotencyRecord.delete({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: userId,
            operation,
            idempotencyKey: idempotency.key,
          },
        },
      });
      return null;
    }
    if (existing.requestHash !== idempotency.requestHash) {
      throw AppError.conflict(
        'IDEMPOTENCY_KEY_REUSED',
        'La clave de idempotencia ya fue utilizada con otro contenido.'
      );
    }
    return existing.resourceId;
  }

  private recordIdempotency(
    transaction: Prisma.TransactionClient,
    userId: string,
    operation: string,
    idempotency: AppointmentIdempotency,
    resourceId: string
  ) {
    return transaction.idempotencyRecord.create({
      data: {
        actorUserId: userId,
        operation,
        idempotencyKey: idempotency.key,
        requestHash: idempotency.requestHash,
        resourceId,
        expiresAt: idempotency.expiresAt,
      },
    });
  }

  private writeAudit(
    transaction: Prisma.TransactionClient,
    audit: AppointmentAuditContext,
    action: string,
    appointmentId: string,
    metadata?: Prisma.InputJsonObject
  ) {
    return transaction.auditEvent.create({
      data: {
        actorUserId: audit.actorUserId,
        action,
        resourceType: 'appointment',
        resourceId: appointmentId,
        requestId: audit.requestId,
        ipAddress: audit.ipAddress,
        metadata,
      },
    });
  }

  private writeOutbox(
    transaction: Prisma.TransactionClient,
    appointment: AppointmentRow,
    eventType: string,
    patientUserId: string,
    psychologistUserId: string
  ) {
    return transaction.outboxEvent.create({
      data: {
        aggregateType: 'appointment',
        aggregateId: appointment.id,
        eventType,
        payload: {
          appointmentId: appointment.id,
          status: appointment.status,
          userIds: [patientUserId, psychologistUserId],
        },
      },
    });
  }

  private async writeReminders(
    transaction: Prisma.TransactionClient,
    appointment: AppointmentRow,
    patientUserId: string,
    psychologistUserId: string,
    now: Date,
    policy: AppConfig['appointments']
  ): Promise<void> {
    const reminders = policy.reminderMinutesBefore
      .map((minutesBefore) => ({
        minutesBefore,
        availableAt: new Date(appointment.startsAt.getTime() - minutesBefore * 60_000),
      }))
      .filter(({ availableAt }) => availableAt > now);
    if (!reminders.length) return;
    await transaction.outboxEvent.createMany({
      data: reminders.map(({ minutesBefore, availableAt }) => ({
        aggregateType: 'appointment',
        aggregateId: appointment.id,
        eventType: 'appointment.reminder_due',
        availableAt,
        payload: {
          appointmentId: appointment.id,
          userIds: [patientUserId, psychologistUserId],
          startsAt: appointment.startsAt.toISOString(),
          minutesBefore,
        },
      })),
    });
  }
}
