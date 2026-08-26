import jwt, { JwtPayload } from 'jsonwebtoken';
import { AppError } from '../../../../shared/domain/appError';
import { AccessTokenService } from '../../application/ports';
import { AccessTokenClaims, RoleCode } from '../../domain/identityTypes';

export interface JwtConfiguration {
  readonly secret: string;
  readonly issuer: string;
  readonly audience: string;
  readonly expiresInSeconds: number;
}

const VALID_ROLES = new Set<RoleCode>([
  'patient',
  'psychologist',
  'administrator',
  'clinical_auditor',
]);

export class JwtAccessTokenService implements AccessTokenService {
  readonly expiresInSeconds: number;

  constructor(private readonly config: JwtConfiguration) {
    this.expiresInSeconds = config.expiresInSeconds;
  }

  issue(claims: AccessTokenClaims): string {
    return jwt.sign(
      { sid: claims.sessionId, roles: claims.roles },
      this.config.secret,
      {
        algorithm: 'HS256',
        audience: this.config.audience,
        issuer: this.config.issuer,
        subject: claims.userId,
        expiresIn: this.config.expiresInSeconds,
        notBefore: 0,
      }
    );
  }

  verify(token: string): AccessTokenClaims {
    let decoded: JwtPayload;
    try {
      const result = jwt.verify(token, this.config.secret, {
        algorithms: ['HS256'],
        audience: this.config.audience,
        issuer: this.config.issuer,
      });
      if (typeof result === 'string') throw new Error('Unexpected JWT payload');
      decoded = result;
    } catch {
      throw AppError.unauthorized('INVALID_ACCESS_TOKEN');
    }

    const roles = Array.isArray(decoded.roles)
      ? decoded.roles.filter(
          (role): role is RoleCode => typeof role === 'string' && VALID_ROLES.has(role as RoleCode)
        )
      : [];
    if (!decoded.sub || typeof decoded.sid !== 'string' || roles.length === 0) {
      throw AppError.unauthorized('INVALID_ACCESS_TOKEN');
    }

    return { userId: decoded.sub, sessionId: decoded.sid, roles };
  }
}
