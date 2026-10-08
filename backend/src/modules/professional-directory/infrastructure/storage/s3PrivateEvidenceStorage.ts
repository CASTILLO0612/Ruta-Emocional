import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../../../generated/prisma/client';
import type { S3QuarantineObjectStore } from '../../../../shared/infrastructure/storage/s3QuarantineObjectStore';
import type { LocalQaEvidenceContentType } from '../../domain/professionalDirectoryTypes';
import type { LocalQaEvidenceFile, PrivateEvidenceStorage } from '../../application/ports';

const EXTENSIONS: Readonly<Record<LocalQaEvidenceContentType, string>> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

export class S3PrivateEvidenceStorage implements PrivateEvidenceStorage {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly objects: S3QuarantineObjectStore
  ) {}

  async store(file: LocalQaEvidenceFile): Promise<{ readonly objectKey: string }> {
    const mediaId = randomUUID();
    const objectKey = `quarantine/professional-evidence/${file.userId}/${file.licenseId}/${mediaId}${EXTENSIONS[file.contentType]}`;
    await this.objects.put(objectKey, file.bytes, file.contentType);
    try {
      await this.prisma.mediaObject.create({
        data: {
          id: mediaId,
          ownerUserId: file.userId,
          purpose: 'PROFESSIONAL_EVIDENCE',
          targetResourceId: file.licenseId,
          objectKey,
          contentType: file.contentType,
          byteSize: file.bytes.byteLength,
        },
      });
    } catch (error) {
      await this.objects.remove(objectKey).catch(() => undefined);
      throw error;
    }
    return { objectKey };
  }

  async remove(objectKey: string): Promise<void> {
    const media = await this.prisma.mediaObject.findUnique({ where: { objectKey } });
    await this.objects.remove(objectKey);
    if (media) {
      await this.prisma.mediaObject.update({
        where: { id: media.id },
        data: { discardedAt: new Date() },
      });
    }
  }
}
