import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../../../generated/prisma/client';
import type { S3QuarantineObjectStore } from '../../../../shared/infrastructure/storage/s3QuarantineObjectStore';
import type {
  ProfilePhotoContentType,
  ProfilePhotoFile,
  ProfilePhotoStorage,
  ReadProfilePhoto,
  StoredProfilePhoto,
} from '../../application/ports';

const EXTENSIONS: Readonly<Record<ProfilePhotoContentType, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const PUBLIC_PREFIX = '/api/v1/auth/profile-photos/';

export class S3ProfilePhotoStorage implements ProfilePhotoStorage {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly objects: S3QuarantineObjectStore
  ) {}

  async store(userId: string, file: ProfilePhotoFile): Promise<StoredProfilePhoto> {
    const mediaId = randomUUID();
    const photoId = `${mediaId}${EXTENSIONS[file.contentType]}`;
    const objectKey = `quarantine/profile-photos/${userId}/${photoId}`;
    const publicPath = `${PUBLIC_PREFIX}${photoId}`;
    await this.objects.put(objectKey, file.bytes, file.contentType);
    try {
      await this.prisma.mediaObject.create({
        data: {
          id: mediaId,
          ownerUserId: userId,
          purpose: 'PROFILE_PHOTO',
          objectKey,
          publicPath,
          contentType: file.contentType,
          byteSize: file.bytes.byteLength,
        },
      });
    } catch (error) {
      await this.objects.remove(objectKey).catch(() => undefined);
      throw error;
    }
    return { id: photoId, publicPath, availability: 'PENDING_SCAN' };
  }

  async read(photoId: string): Promise<ReadProfilePhoto | null> {
    const publicPath = `${PUBLIC_PREFIX}${photoId}`;
    const media = await this.prisma.mediaObject.findFirst({
      where: {
        publicPath,
        purpose: 'PROFILE_PHOTO',
        scanStatus: 'CLEAN',
        discardedAt: null,
      },
    });
    if (!media) return null;
    const contentType = media.contentType as ProfilePhotoContentType;
    const object = await this.objects.read(media.objectKey);
    return { ...object, contentType };
  }

  async remove(publicPath: string): Promise<void> {
    if (!publicPath.startsWith(PUBLIC_PREFIX)) return;
    const media = await this.prisma.mediaObject.findFirst({ where: { publicPath } });
    if (!media) return;
    await this.objects.remove(media.objectKey);
    await this.prisma.mediaObject.update({
      where: { id: media.id },
      data: { discardedAt: new Date() },
    });
  }
}
