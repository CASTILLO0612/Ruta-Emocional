import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';
import { PasswordHasher, PasswordVerification } from '../../application/ports';

export interface ScryptConfiguration {
  readonly pepper: string;
  readonly n: number;
  readonly r: number;
  readonly p: number;
  readonly keyLength: number;
}

const MAX_SCRYPT_N = 1_048_576;

export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly config: ScryptConfiguration) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await this.derive(password, salt, this.config);
    return [
      'scrypt',
      this.config.n,
      this.config.r,
      this.config.p,
      this.config.keyLength,
      salt.toString('base64url'),
      derived.toString('base64url'),
    ].join('$');
  }

  async verify(password: string, encodedHash: string): Promise<PasswordVerification> {
    if (encodedHash.startsWith('$2')) {
      const valid = await bcrypt.compare(password, encodedHash);
      return { valid, needsRehash: valid };
    }

    const parsed = this.parse(encodedHash);
    if (!parsed) return { valid: false, needsRehash: false };

    const derived = await this.derive(password, parsed.salt, parsed);
    const valid = derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
    const needsRehash = valid && (
      parsed.n !== this.config.n
      || parsed.r !== this.config.r
      || parsed.p !== this.config.p
      || parsed.keyLength !== this.config.keyLength
    );
    return { valid, needsRehash };
  }

  private prehash(password: string): Buffer {
    return createHmac('sha256', this.config.pepper).update(password, 'utf8').digest();
  }

  private derive(
    password: string,
    salt: Buffer,
    parameters: Pick<ScryptConfiguration, 'n' | 'r' | 'p' | 'keyLength'>
  ): Promise<Buffer> {
    const requiredMemory = 128 * parameters.n * parameters.r;
    const maxmem = Math.max(requiredMemory + 16 * 1024 * 1024, 64 * 1024 * 1024);
    return new Promise((resolve, reject) => {
      scrypt(
        this.prehash(password),
        salt,
        parameters.keyLength,
        { N: parameters.n, r: parameters.r, p: parameters.p, maxmem },
        (error, derivedKey) => {
          if (error) reject(error);
          else resolve(derivedKey);
        }
      );
    });
  }

  private parse(encodedHash: string): (
    Pick<ScryptConfiguration, 'n' | 'r' | 'p' | 'keyLength'>
    & { salt: Buffer; hash: Buffer }
  ) | null {
    const [algorithm, nRaw, rRaw, pRaw, keyLengthRaw, saltRaw, hashRaw, ...extra] = encodedHash.split('$');
    if (algorithm !== 'scrypt' || extra.length > 0 || !saltRaw || !hashRaw) return null;

    const n = Number(nRaw);
    const r = Number(rRaw);
    const p = Number(pRaw);
    const keyLength = Number(keyLengthRaw);
    if (
      !Number.isInteger(n) || n < 16_384 || n > MAX_SCRYPT_N
      || !Number.isInteger(r) || r < 1 || r > 32
      || !Number.isInteger(p) || p < 1 || p > 16
      || !Number.isInteger(keyLength) || keyLength < 32 || keyLength > 128
    ) return null;

    try {
      const salt = Buffer.from(saltRaw, 'base64url');
      const hash = Buffer.from(hashRaw, 'base64url');
      if (salt.length < 16 || hash.length !== keyLength) return null;
      return { n, r, p, keyLength, salt, hash };
    } catch {
      return null;
    }
  }
}
