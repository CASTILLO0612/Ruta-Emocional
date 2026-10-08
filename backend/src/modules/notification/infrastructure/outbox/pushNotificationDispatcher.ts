import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../../../../config/env';
import { Prisma, PrismaClient } from '../../../../generated/prisma/client';
import type { Logger } from '../../../../shared/infrastructure/logging/logger';
import { ExpoPushProvider } from '../providers/expoPushProvider';

interface ClaimedDelivery {
  readonly id: string;
  readonly attempts: number;
  readonly pushDeviceId: string;
  readonly expoPushToken: string;
  readonly title: string;
  readonly body: string;
  readonly data: Prisma.JsonValue;
}

export class PushNotificationDispatcher {
  private stopped = true;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: ExpoPushProvider,
    private readonly logger: Logger,
    private readonly config: AppConfig['pushNotifications']
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
    const staleBefore = new Date(Date.now() - this.config.claimTtlSeconds * 1000);
    const deliveries = await this.prisma.$queryRaw<ClaimedDelivery[]>(Prisma.sql`
      WITH candidates AS (
        SELECT delivery."id"
          FROM "push_deliveries" delivery
         WHERE delivery."status" = 'PENDING'
           AND delivery."available_at" <= CURRENT_TIMESTAMP
           AND (delivery."claimed_at" IS NULL OR delivery."claimed_at" < ${staleBefore})
         ORDER BY delivery."created_at", delivery."id"
         LIMIT ${this.config.batchSize}
         FOR UPDATE SKIP LOCKED
      )
      UPDATE "push_deliveries" delivery
         SET "claim_token" = ${claimToken}::uuid,
             "claimed_at" = CURRENT_TIMESTAMP,
             "attempts" = delivery."attempts" + 1
        FROM candidates, "push_devices" device
       WHERE delivery."id" = candidates."id"
         AND device."id" = delivery."push_device_id"
      RETURNING delivery."id",
                delivery."attempts",
                delivery."push_device_id" AS "pushDeviceId",
                device."expo_push_token" AS "expoPushToken",
                delivery."title",
                delivery."body",
                delivery."data"
    `);
    for (const delivery of deliveries) await this.deliver(delivery, claimToken);
    await this.checkReceipts();
    return deliveries.length;
  }

  private async runCycle(): Promise<void> {
    try {
      await this.drainOnce();
    } catch {
      this.logger.error('push.dispatch.cycle_failed');
    } finally {
      if (!this.stopped) {
        this.timer = setTimeout(() => void this.runCycle(), this.config.pollIntervalMs);
        this.timer.unref();
      }
    }
  }

  private async deliver(delivery: ClaimedDelivery, claimToken: string): Promise<void> {
    try {
      const ticket = await this.provider.send({
        to: delivery.expoPushToken,
        title: delivery.title,
        body: delivery.body,
        data: delivery.data && typeof delivery.data === 'object' && !Array.isArray(delivery.data)
          ? delivery.data as Record<string, unknown>
          : {},
      });
      if (ticket.status === 'error') {
        await this.failDelivery(delivery, claimToken, ticket.errorCode ?? 'PROVIDER_REJECTED');
        return;
      }
      if (!ticket.id) throw new Error('PUSH_TICKET_ID_MISSING');
      await this.prisma.pushDelivery.updateMany({
        where: { id: delivery.id, claimToken },
        data: {
          status: 'ACCEPTED',
          providerTicketId: ticket.id,
          availableAt: new Date(Date.now() + this.config.receiptInitialDelayMs),
          claimedAt: null,
          claimToken: null,
          lastErrorCode: null,
        },
      });
    } catch {
      const permanent = delivery.attempts >= this.config.maximumAttempts;
      const retryDelay = Math.min(
        this.config.retryBaseDelayMs * (2 ** Math.max(0, delivery.attempts - 1)),
        3_600_000
      );
      await this.prisma.pushDelivery.updateMany({
        where: { id: delivery.id, claimToken },
        data: {
          status: permanent ? 'FAILED' : 'PENDING',
          claimedAt: null,
          claimToken: null,
          lastErrorCode: permanent ? 'PROVIDER_UNAVAILABLE' : null,
          ...(!permanent ? { availableAt: new Date(Date.now() + retryDelay) } : {}),
        },
      });
      this.logger.error('push.dispatch.delivery_failed', {
        deliveryId: delivery.id,
        attempt: delivery.attempts,
        permanent,
      });
    }
  }

  private async failDelivery(
    delivery: ClaimedDelivery,
    claimToken: string,
    errorCode: string
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.pushDelivery.updateMany({
        where: { id: delivery.id, claimToken },
        data: {
          status: 'FAILED',
          claimedAt: null,
          claimToken: null,
          lastErrorCode: errorCode,
        },
      });
      if (errorCode === 'DeviceNotRegistered') {
        await transaction.pushDevice.update({
          where: { id: delivery.pushDeviceId },
          data: { active: false, disabledAt: new Date() },
        });
      }
    });
  }

  private async checkReceipts(): Promise<void> {
    const accepted = await this.prisma.pushDelivery.findMany({
      where: {
        status: 'ACCEPTED',
        providerTicketId: { not: null },
        availableAt: { lte: new Date() },
      },
      orderBy: { createdAt: 'asc' },
      take: this.config.receiptBatchSize,
      select: { id: true, providerTicketId: true, pushDeviceId: true },
    });
    const ticketIds = accepted.flatMap(({ providerTicketId }) => providerTicketId ? [providerTicketId] : []);
    if (ticketIds.length === 0) return;
    const checkedAt = new Date();
    await this.prisma.pushDelivery.updateMany({
      where: { id: { in: accepted.map(({ id }) => id) }, status: 'ACCEPTED' },
      data: {
        receiptCheckedAt: checkedAt,
        availableAt: new Date(checkedAt.getTime() + this.config.receiptRetryDelayMs),
      },
    });
    const receipts = await this.provider.receipts(ticketIds);
    for (const delivery of accepted) {
      const ticketId = delivery.providerTicketId;
      if (!ticketId) continue;
      const receipt = receipts[ticketId];
      if (!receipt) continue;
      await this.prisma.$transaction(async (transaction) => {
        await transaction.pushDelivery.update({
          where: { id: delivery.id },
          data: {
            status: receipt.status === 'ok' ? 'DELIVERED' : 'FAILED',
            receiptCheckedAt: checkedAt,
            lastErrorCode: receipt.errorCode ?? null,
          },
        });
        if (receipt.errorCode === 'DeviceNotRegistered') {
          await transaction.pushDevice.update({
            where: { id: delivery.pushDeviceId },
            data: { active: false, disabledAt: new Date() },
          });
        }
      });
    }
  }
}
