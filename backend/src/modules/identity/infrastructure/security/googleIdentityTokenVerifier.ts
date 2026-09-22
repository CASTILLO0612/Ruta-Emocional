import { createPublicKey, verify as verifySignature, type JsonWebKey } from 'crypto';
import { AppError } from '../../../../shared/domain/appError';
import type {
  FederatedIdentityVerifier,
  VerifiedFederatedIdentity,
} from '../../application/ports';

interface GoogleIdentityTokenVerifierConfig {
  readonly clientId: string;
  readonly timeoutMs: number;
}

interface JsonWebKeySet {
  readonly keys: GoogleJsonWebKey[];
}

interface GoogleJsonWebKey extends JsonWebKey {
  readonly kid?: string;
  readonly kty?: string;
  readonly alg?: string;
  readonly use?: string;
  readonly n?: string;
  readonly e?: string;
}

interface TokenHeader {
  readonly alg?: string;
  readonly kid?: string;
}

interface TokenClaims {
  readonly iss?: string;
  readonly aud?: string;
  readonly sub?: string;
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly name?: string;
  readonly picture?: string;
  readonly exp?: number;
  readonly iat?: number;
}

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const VALID_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const CLOCK_SKEW_SECONDS = 60;

export class GoogleIdentityTokenVerifier implements FederatedIdentityVerifier {
  private keys = new Map<string, GoogleJsonWebKey>();
  private keysExpireAt = 0;

  constructor(private readonly config: GoogleIdentityTokenVerifierConfig) {}

  async verify(idToken: string): Promise<VerifiedFederatedIdentity> {
    const segments = idToken.split('.');
    if (segments.length !== 3 || idToken.length > 16_384) throw this.invalidToken();

    const header = this.decodeJson<TokenHeader>(segments[0]);
    const claims = this.decodeJson<TokenClaims>(segments[1]);
    if (header.alg !== 'RS256' || !header.kid) throw this.invalidToken();

    const key = await this.getKey(header.kid);
    const signature = this.decodeBase64Url(segments[2]);
    const validSignature = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${segments[0]}.${segments[1]}`, 'utf8'),
      createPublicKey({ key, format: 'jwk' }),
      signature
    );
    if (!validSignature) throw this.invalidToken();

    const now = Math.floor(Date.now() / 1000);
    if (
      !claims.iss
      || !VALID_ISSUERS.has(claims.iss)
      || claims.aud !== this.config.clientId
      || !claims.sub
      || !claims.email
      || claims.email_verified !== true
      || !claims.exp
      || claims.exp < now - CLOCK_SKEW_SECONDS
      || (claims.iat !== undefined && claims.iat > now + CLOCK_SKEW_SECONDS)
    ) {
      throw this.invalidToken();
    }

    return {
      provider: 'GOOGLE',
      subject: claims.sub,
      email: claims.email,
      emailVerified: true,
      displayName: claims.name?.trim() || claims.email.split('@')[0],
      photoUrl: claims.picture?.trim() || null,
    };
  }

  private async getKey(kid: string): Promise<GoogleJsonWebKey> {
    if (Date.now() >= this.keysExpireAt || !this.keys.has(kid)) await this.refreshKeys();
    const key = this.keys.get(kid);
    if (!key || key.kty !== 'RSA' || key.alg !== 'RS256' || key.use !== 'sig') {
      throw this.invalidToken();
    }
    return key;
  }

  private async refreshKeys(): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(GOOGLE_JWKS_URL, { signal: controller.signal });
      if (!response.ok) throw this.unavailable();
      const body = await response.json() as JsonWebKeySet;
      if (!Array.isArray(body.keys)) throw this.unavailable();
      this.keys = new Map(
        body.keys
          .filter((key) => typeof key.kid === 'string')
          .map((key) => [key.kid!, key])
      );
      const cacheControl = response.headers.get('cache-control') ?? '';
      const maximumAge = Number(/max-age=(\d+)/i.exec(cacheControl)?.[1] ?? 300);
      this.keysExpireAt = Date.now() + Math.max(60, Math.min(maximumAge, 86_400)) * 1_000;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw this.unavailable();
    } finally {
      clearTimeout(timer);
    }
  }

  private decodeJson<T>(segment: string): T {
    try {
      return JSON.parse(this.decodeBase64Url(segment).toString('utf8')) as T;
    } catch {
      throw this.invalidToken();
    }
  }

  private decodeBase64Url(value: string): Buffer {
    try {
      return Buffer.from(value, 'base64url');
    } catch {
      throw this.invalidToken();
    }
  }

  private invalidToken(): AppError {
    return AppError.unauthorized('INVALID_GOOGLE_ID_TOKEN');
  }

  private unavailable(): AppError {
    return new AppError(
      503,
      'GOOGLE_IDENTITY_UNAVAILABLE',
      'Servicio temporalmente no disponible',
      'No pudimos validar tu cuenta de Google en este momento.'
    );
  }
}
