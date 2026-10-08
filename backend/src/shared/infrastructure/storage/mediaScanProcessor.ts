import type { AppConfig } from '../../../config/env';
import type { PrismaClient } from '../../../generated/prisma/client';
import type { Logger } from '../logging/logger';
import type {
  GuardDutyObjectStatus,
  S3QuarantineObjectStore,
} from './s3QuarantineObjectStore';

export class MediaScanProcessor {
  private stopped = true;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly objects: S3QuarantineObjectStore,
    private readonly logger: Logger,
    private readonly config: AppConfig['media']
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
    const pending = await this.prisma.mediaObject.findMany({
      where: { scanStatus: 'PENDING', discardedAt: null },
      orderBy: { createdAt: 'asc' },
      take: this.config.scanBatchSize,
    });
    for (const media of pending) {
      try {
        const status = await this.objects.guardDutyStatus(media.objectKey);
        await this.applyStatus(media.id, status);
      } catch {
        this.logger.error('media.scan.status_check_failed', { mediaId: media.id });
      }
    }
    return pending.length;
  }

  private async runCycle(): Promise<void> {
    try {
      await this.drainOnce();
    } catch {
      this.logger.error('media.scan.cycle_failed');
    } finally {
      if (!this.stopped) {
        this.timer = setTimeout(() => void this.runCycle(), this.config.scanPollIntervalMs);
        this.timer.unref();
      }
    }
  }

  private async applyStatus(mediaId: string, providerStatus: GuardDutyObjectStatus): Promise<void> {
    if (providerStatus === 'PENDING') return;
    const now = new Date();
    if (providerStatus === 'NO_THREATS_FOUND') {
      const outcome = await this.prisma.$transaction(async (transaction) => {
        const media = await transaction.mediaObject.findUnique({ where: { id: mediaId } });
        if (!media || media.scanStatus !== 'PENDING' || media.discardedAt) return null;
        if (media.purpose !== 'PROFILE_PHOTO') {
          await transaction.mediaObject.update({
            where: { id: media.id },
            data: { scanStatus: 'CLEAN', scannedAt: now },
          });
          return { removeObjectKey: null as string | null };
        }
        const newer = await transaction.mediaObject.findFirst({
          where: {
            ownerUserId: media.ownerUserId,
            purpose: 'PROFILE_PHOTO',
            createdAt: { gt: media.createdAt },
            discardedAt: null,
          },
          select: { id: true },
        });
        if (newer) {
          await transaction.mediaObject.update({
            where: { id: media.id },
            data: { scanStatus: 'CLEAN', scannedAt: now, discardedAt: now },
          });
          return { removeObjectKey: media.objectKey };
        }
        const user = await transaction.user.findUnique({
          where: { id: media.ownerUserId },
          select: { photoUrl: true },
        });
        if (!user || !media.publicPath) return null;
        await transaction.user.update({
          where: { id: media.ownerUserId },
          data: { photoUrl: media.publicPath },
        });
        await transaction.mediaObject.update({
          where: { id: media.id },
          data: { scanStatus: 'CLEAN', scannedAt: now, activatedAt: now },
        });
        const previous = user.photoUrl
          ? await transaction.mediaObject.findFirst({ where: { publicPath: user.photoUrl } })
          : null;
        if (previous && previous.id !== media.id) {
          await transaction.mediaObject.update({
            where: { id: previous.id },
            data: { discardedAt: now },
          });
        }
        return { removeObjectKey: previous?.objectKey ?? null };
      });
      if (outcome?.removeObjectKey) {
        await this.objects.remove(outcome.removeObjectKey).catch(() => undefined);
      }
      return;
    }

    const scanStatus = providerStatus === 'THREATS_FOUND' ? 'INFECTED' : 'FAILED';
    const media = await this.prisma.mediaObject.update({
      where: { id: mediaId },
      data: { scanStatus, scannedAt: now },
    });
    if (scanStatus === 'INFECTED') {
      await this.objects.remove(media.objectKey).catch(() => undefined);
      await this.prisma.mediaObject.update({
        where: { id: media.id },
        data: { discardedAt: new Date() },
      });
    }
  }
}
