import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { LocalQaEvidenceContentType } from '../../domain/professionalDirectoryTypes';
import type { LocalQaEvidenceFile, PrivateEvidenceStorage } from '../../application/ports';

const EXTENSIONS: Readonly<Record<LocalQaEvidenceContentType, string>> = Object.freeze({
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
});
const OBJECT_KEY_PREFIX = 'local-qa/professional-evidence/';

export class LocalPrivateEvidenceStorage implements PrivateEvidenceStorage {
  private readonly rootDirectory: string;

  constructor(rootDirectory: string) {
    this.rootDirectory = path.resolve(rootDirectory);
  }

  async store(file: LocalQaEvidenceFile): Promise<{ readonly objectKey: string }> {
    const relativePath = path.join(
      file.userId,
      file.licenseId,
      `${randomUUID()}${EXTENSIONS[file.contentType]}`
    );
    const targetPath = this.resolveObjectPath(`${OBJECT_KEY_PREFIX}${relativePath.replaceAll('\\', '/')}`);
    await mkdir(path.dirname(targetPath), { recursive: true, mode: 0o700 });
    await writeFile(targetPath, file.bytes, { flag: 'wx', mode: 0o600 });
    return { objectKey: `${OBJECT_KEY_PREFIX}${relativePath.replaceAll('\\', '/')}` };
  }

  async remove(objectKey: string): Promise<void> {
    await rm(this.resolveObjectPath(objectKey), { force: true });
  }

  private resolveObjectPath(objectKey: string): string {
    if (!objectKey.startsWith(OBJECT_KEY_PREFIX)) {
      throw new Error('INVALID_LOCAL_EVIDENCE_OBJECT_KEY');
    }
    const relativePath = objectKey.slice(OBJECT_KEY_PREFIX.length);
    const targetPath = path.resolve(this.rootDirectory, relativePath);
    const rootPrefix = `${this.rootDirectory}${path.sep}`;
    if (!targetPath.startsWith(rootPrefix)) {
      throw new Error('INVALID_LOCAL_EVIDENCE_OBJECT_KEY');
    }
    return targetPath;
  }
}
