import { createHash, randomBytes } from 'crypto';

import type {
  IssuedPasswordResetToken,
  PasswordResetTokenService,
} from '../../application/ports';

const TOKEN_BYTES = 32;

export class OpaquePasswordResetTokenService implements PasswordResetTokenService {
  issue(): IssuedPasswordResetToken {
    const token = randomBytes(TOKEN_BYTES).toString('base64url');
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
