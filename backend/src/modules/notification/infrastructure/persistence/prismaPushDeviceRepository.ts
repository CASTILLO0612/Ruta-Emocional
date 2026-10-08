import { PushPlatform, PrismaClient } from '../../../../generated/prisma/client';
import type { PushDeviceRepository } from '../../application/ports';
import type { RegisterPushDeviceInput } from '../../domain/notificationTypes';

export class PrismaPushDeviceRepository implements PushDeviceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async register(userId: string, input: RegisterPushDeviceInput) {
    const now = new Date();
    const device = await this.prisma.$transaction(async (transaction) => {
      await transaction.pushDevice.updateMany({
        where: {
          expoPushToken: input.expoPushToken,
          NOT: { userId, installationId: input.installationId },
        },
        data: { active: false, disabledAt: now },
      });
      return transaction.pushDevice.upsert({
        where: {
          userId_installationId: { userId, installationId: input.installationId },
        },
        create: {
          userId,
          installationId: input.installationId,
          expoPushToken: input.expoPushToken,
          platform: input.platform as PushPlatform,
          active: true,
          lastSeenAt: now,
        },
        update: {
          expoPushToken: input.expoPushToken,
          platform: input.platform as PushPlatform,
          active: true,
          disabledAt: null,
          lastSeenAt: now,
        },
      });
    });
    return {
      installationId: device.installationId,
      platform: device.platform,
      active: device.active,
      lastSeenAt: device.lastSeenAt.toISOString(),
    };
  }

  async deactivate(userId: string, installationId: string): Promise<void> {
    await this.prisma.pushDevice.updateMany({
      where: { userId, installationId },
      data: { active: false, disabledAt: new Date() },
    });
  }
}
