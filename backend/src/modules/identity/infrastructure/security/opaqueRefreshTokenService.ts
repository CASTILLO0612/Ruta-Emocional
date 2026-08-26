import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { AppError } from '../../../../shared/domain/appError';
import { IssuedRefreshToken, ParsedRefreshToken, RefreshTokenService } from '../../application/ports';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export class OpaqueRefreshTokenService implements RefreshTokenService {
  issue(sessionId: string): IssuedRefreshToken {
    const token = `${sessionId}.${randomBytes(32).toString('base64url')}`;
    return { token, hash: hashToken(token) };
  }

  parse(token: string): ParsedRefreshToken {
    const separator = token.indexOf('.');
    const sessionId = separator > 0 ? token.slice(0, separator) : '';
    const secret = separator > 0 ? token.slice(separator + 1) : '';
    if (!UUID_PATTERN.test(sessionId) || !SECRET_PATTERN.test(secret)) {
      throw AppError.unauthorized('INVALID_REFRESH_TOKEN');
    }
    return { sessionId, hash: hashToken(token) };
  }

  hashesMatch(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
