import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ClinicalContentCipher } from '../../application/ports';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;

export class AesGcmClinicalContentCipher implements ClinicalContentCipher {
  private readonly keys: ReadonlyMap<number, Buffer>;

  constructor(
    keys: Readonly<Record<number, string>>,
    private readonly activeVersion: number
  ) {
    this.keys = new Map(Object.entries(keys).map(([version, value]) => [
      Number(version),
      Buffer.from(value, 'base64'),
    ]));
    if (!this.keys.has(activeVersion)) {
      throw new Error('Active clinical encryption key is not present in the key ring');
    }
  }

  encrypt(plaintext: string, context: string): string {
    const key = this.keys.get(this.activeVersion)!;
    const nonce = randomBytes(NONCE_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, nonce);
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      `v${this.activeVersion}`,
      nonce.toString('base64url'),
      tag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join('.');
  }

  decrypt(envelope: string, context: string): string {
    const [versionPart, noncePart, tagPart, ciphertextPart, extra] = envelope.split('.');
    const version = Number(versionPart?.slice(1));
    const key = this.keys.get(version);
    if (
      extra !== undefined
      || !/^v[1-9][0-9]*$/.test(versionPart ?? '')
      || !key
      || !noncePart
      || !tagPart
      || !ciphertextPart
    ) {
      throw new Error('Clinical content envelope is invalid or uses an unavailable key');
    }
    const nonce = Buffer.from(noncePart, 'base64url');
    const tag = Buffer.from(tagPart, 'base64url');
    if (nonce.length !== NONCE_BYTES || tag.length !== 16) {
      throw new Error('Clinical content envelope has invalid cryptographic parameters');
    }
    const decipher = createDecipheriv(ALGORITHM, key, nonce);
    decipher.setAAD(Buffer.from(context, 'utf8'));
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
}
