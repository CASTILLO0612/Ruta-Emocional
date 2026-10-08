import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  ProfilePhotoContentType,
  ProfilePhotoFile,
  ProfilePhotoStorage,
  ReadProfilePhoto,
  StoredProfilePhoto,
} from '../../application/ports';

const EXTENSIONS: Readonly<Record<ProfilePhotoContentType, string>> = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
});
const CONTENT_TYPES: Readonly<Record<string, ProfilePhotoContentType>> = Object.freeze({
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
});
const PUBLIC_PREFIX = '/api/v1/auth/profile-photos/';
const PHOTO_ID_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export class LocalProfilePhotoStorage implements ProfilePhotoStorage {
  private readonly rootDirectory: string;

  constructor(rootDirectory: string) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  async store(_userId: string, file: ProfilePhotoFile): Promise<StoredProfilePhoto> {
    const id = `${randomUUID()}${EXTENSIONS[file.contentType]}`;
    const target = this.resolvePhotoPath(id);
    await mkdir(this.rootDirectory, { recursive: true, mode: 0o700 });
    await writeFile(target, file.bytes, { flag: 'wx', mode: 0o600 });
    return { id, publicPath: `${PUBLIC_PREFIX}${id}` };
  }

  async read(photoId: string): Promise<ReadProfilePhoto | null> {
    if (!PHOTO_ID_PATTERN.test(photoId)) return null;
    try {
      const bytes = await readFile(this.resolvePhotoPath(photoId));
      const contentType = CONTENT_TYPES[path.extname(photoId)];
      if (!contentType) return null;
      return {
        bytes,
        contentType,
        etag: `"${createHash('sha256').update(bytes).digest('base64url')}"`,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async remove(publicPath: string): Promise<void> {
    if (!publicPath.startsWith(PUBLIC_PREFIX)) return;
    const id = publicPath.slice(PUBLIC_PREFIX.length);
    if (!PHOTO_ID_PATTERN.test(id)) return;
    await rm(this.resolvePhotoPath(id), { force: true });
  }

  private resolvePhotoPath(photoId: string): string {
    if (!PHOTO_ID_PATTERN.test(photoId)) throw new Error('INVALID_PROFILE_PHOTO_ID');
    const target = path.resolve(this.rootDirectory, photoId);
    if (path.dirname(target) !== this.rootDirectory) throw new Error('INVALID_PROFILE_PHOTO_ID');
    return target;
  }
}
