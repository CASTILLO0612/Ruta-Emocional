import { randomUUID } from 'crypto';
import type { AppConfig } from '../../../../config/env';
import { Prisma, PrismaClient } from '../../../../generated/prisma/client';
import type { Logger } from '../../../../shared/infrastructure/logging/logger';
import type { RealtimePublisher } from '../../../../sockets/socketHandler';
import type { MessagingService } from '../../application/messagingService';

interface ClaimedEvent {
  readonly id: string;
  readonly eventType: string;
  readonly payload: Prisma.JsonValue;
  readonly attempts: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function messageIdFromPayload(payload: Prisma.JsonValue): string | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const value = (payload as Prisma.JsonObject).messageId;
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
}

function verificationUpdateFromPayload(payload: Prisma.JsonValue): {
  readonly userId: string;
  readonly status: 'VERIFIED' | 'REJECTED';
} | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const record = payload as Prisma.JsonObject;
  const userId = record.userId;
  const status = record.status;
  if (typeof userId !== 'string' || !UUID_PATTERN.test(userId)) return null;
  if (status !== 'VERIFIED' && status !== 'REJECTED') return null;
  return { userId: userId.toLowerCase(), status };
}

function appointmentUpdateFromPayload(payload: Prisma.JsonValue): {
  readonly appointmentId: string;
  readonly status: string;
  readonly userIds: readonly string[];
} | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const record = payload as Prisma.JsonObject;
  const appointmentId = record.appointmentId;
  const status = record.status;
  const userIds = record.userIds;
  if (typeof appointmentId !== 'string' || !UUID_PATTERN.test(appointmentId)) return null;
  if (typeof status !== 'string' || !Array.isArray(userIds)) return null;
  const normalizedUserIds = userIds.filter(
    (value): value is string => typeof value === 'string' && UUID_PATTERN.test(value)
  );
  if (normalizedUserIds.length !== userIds.length || normalizedUserIds.length === 0) return null;
  return {
    appointmentId: appointmentId.toLowerCase(),
    status,
    userIds: normalizedUserIds.map((value) => value.toLowerCase()),
  };
}

function appointmentReminderFromPayload(payload: Prisma.JsonValue): {
  readonly appointmentId: string;
  readonly startsAt: string;
  readonly minutesBefore: number;
  readonly userIds: readonly string[];
} | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
  const record = payload as Prisma.JsonObject;
  const appointmentId = record.appointmentId;
  const startsAt = record.startsAt;
  const minutesBefore = record.minutesBefore;
  const userIds = record.userIds;
  if (typeof appointmentId !== 'string' || !UUID_PATTERN.test(appointmentId)) return null;
  if (
    typeof startsAt !== 'string'
    || Number.isNaN(new Date(startsAt).getTime())
    || typeof minutesBefore !== 'number'
    || !Number.isInteger(minutesBefore)
    || minutesBefore < 1
    || !Array.isArray(userIds)
  ) return null;
  const normalizedUserIds = userIds.filter(
    (value): value is string => typeof value === 'string' && UUID_PATTERN.test(value)
  );
  if (normalizedUserIds.length !== userIds.length || normalizedUserIds.length === 0) return null;
  return {
    appointmentId: appointmentId.toLowerCase(),
    startsAt: new Date(startsAt).toISOString(),
    minutesBefore,
    userIds: normalizedUserIds.map((value) => value.toLowerCase()),
  };
}

export class MessageOutboxDispatcher {
  private stopped = true;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly messaging: MessagingService,
    private readonly publisher: RealtimePublisher,
    private readonly logger: Logger,
    private readonly config: AppConfig['messaging']
  ) {}

  start(): void {
    if (!this.stopped) return;
    this.stopped = false;
    void this.runCycle();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  async drainOnce(): Promise<number> {
    const claimToken = randomUUID();
    const staleBefore = new Date(Date.now() - this.config.outboxClaimTtlSeconds * 1000);
    const events = await this.prisma.$queryRaw<ClaimedEvent[]>(Prisma.sql`
      WITH candidates AS (
        SELECT "id"
          FROM "outbox_events"
         WHERE "event_type" IN (
           'message.created',
           'psychologist.verification_approved',
           'psychologist.verification_rejected',
           'appointment.created',
           'appointment.updated',
           'appointment.rescheduled',
           'appointment.reminder_due'
         )
           AND "published_at" IS NULL
           AND "dead_lettered_at" IS NULL
           AND "available_at" <= CURRENT_TIMESTAMP
           AND ("claimed_at" IS NULL OR "claimed_at" < ${staleBefore})
         ORDER BY "occurred_at", "id"
         LIMIT ${this.config.outboxBatchSize}
         FOR UPDATE SKIP LOCKED
      )
      UPDATE "outbox_events" event
         SET "claim_token" = ${claimToken}::uuid,
             "claimed_at" = CURRENT_TIMESTAMP,
             "attempts" = event."attempts" + 1
        FROM candidates
       WHERE event."id" = candidates."id"
      RETURNING event."id", event."event_type" AS "eventType", event."payload", event."attempts"
    `);

    for (const event of events) await this.deliver(event, claimToken);
    return events.length;
  }

  private async runCycle(): Promise<void> {
    try {
      await this.drainOnce();
    } catch {
      this.logger.error('outbox.realtime_dispatch.cycle_failed');
    } finally {
      if (!this.stopped) {
        this.timer = setTimeout(() => void this.runCycle(), this.config.outboxPollIntervalMs);
        this.timer.unref();
      }
    }
  }

  private async deliver(event: ClaimedEvent, claimToken: string): Promise<void> {
    try {
      if (event.eventType === 'message.created') {
        const messageId = messageIdFromPayload(event.payload);
        if (!messageId) throw new Error('INVALID_MESSAGE_EVENT_PAYLOAD');
        const message = await this.messaging.findMessageForDelivery(messageId);
        if (!message) throw new Error('MESSAGE_NOT_FOUND');
        await this.publisher.publishMessageCreated(message);
      } else if (event.eventType.startsWith('psychologist.verification_')) {
        const update = verificationUpdateFromPayload(event.payload);
        if (!update) throw new Error('INVALID_VERIFICATION_EVENT_PAYLOAD');
        await this.publisher.publishPsychologistVerificationUpdated(update);
      } else if (event.eventType === 'appointment.reminder_due') {
        const reminder = appointmentReminderFromPayload(event.payload);
        if (!reminder) throw new Error('INVALID_APPOINTMENT_REMINDER_PAYLOAD');
        const appointment = await this.prisma.appointment.findUnique({
          where: { id: reminder.appointmentId },
          select: { startsAt: true, status: true },
        });
        if (
          appointment
          && appointment.startsAt.toISOString() === reminder.startsAt
          && ['SCHEDULED', 'CONFIRMED'].includes(appointment.status)
        ) {
          await this.publisher.publishAppointmentReminder(reminder);
        }
      } else {
        const update = appointmentUpdateFromPayload(event.payload);
        if (!update) throw new Error('INVALID_APPOINTMENT_EVENT_PAYLOAD');
        await this.publisher.publishAppointmentUpdated(update);
      }
      await this.prisma.outboxEvent.updateMany({
        where: { id: event.id, claimToken },
        data: { publishedAt: new Date(), claimedAt: null, claimToken: null, lastError: null },
      });
    } catch {
      const deadLetter = event.attempts >= this.config.outboxMaximumAttempts;
      const retryDelay = Math.min(
        this.config.outboxRetryBaseDelayMs * (2 ** Math.max(0, event.attempts - 1)),
        3_600_000
      );
      await this.prisma.outboxEvent.updateMany({
        where: { id: event.id, claimToken },
        data: {
          claimedAt: null,
          claimToken: null,
          lastError: 'REALTIME_DELIVERY_FAILED',
          ...(deadLetter
            ? { deadLetteredAt: new Date() }
            : { availableAt: new Date(Date.now() + retryDelay) }),
        },
      });
      this.logger.error('outbox.realtime_dispatch.delivery_failed', {
        eventId: event.id,
        eventType: event.eventType,
        attempt: event.attempts,
        deadLetter,
      });
    }
  }
}
