import { createHash } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export type GuardDutyObjectStatus =
  | 'PENDING'
  | 'NO_THREATS_FOUND'
  | 'THREATS_FOUND'
  | 'UNSUPPORTED'
  | 'ACCESS_DENIED'
  | 'FAILED';

export class S3QuarantineObjectStore {
  constructor(
    readonly client: S3Client,
    readonly bucket: string
  ) {}

  async put(objectKey: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: bytes,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
      Tagging: 'uploadState=quarantine',
    }));
  }

  async read(objectKey: string): Promise<{ readonly bytes: Uint8Array; readonly etag: string }> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    if (!result.Body) throw new Error('S3_OBJECT_BODY_MISSING');
    const bytes = await result.Body.transformToByteArray();
    return {
      bytes,
      etag: result.ETag ?? `"${createHash('sha256').update(bytes).digest('base64url')}"`,
    };
  }

  async remove(objectKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey }));
  }

  async guardDutyStatus(objectKey: string): Promise<GuardDutyObjectStatus> {
    const result = await this.client.send(new GetObjectTaggingCommand({
      Bucket: this.bucket,
      Key: objectKey,
    }));
    const value = result.TagSet?.find(({ Key }) => Key === 'GuardDutyMalwareScanStatus')?.Value;
    switch (value) {
      case 'NO_THREATS_FOUND':
      case 'THREATS_FOUND':
      case 'UNSUPPORTED':
      case 'ACCESS_DENIED':
      case 'FAILED':
        return value;
      default:
        return 'PENDING';
    }
  }
}
