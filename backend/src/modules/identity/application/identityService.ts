import { randomUUID } from 'crypto';
import { Clock } from '../../../shared/application/clock';
import { AppError } from '../../../shared/domain/appError';
import {
  AccessTokenService,
  IdentityRepository,
  PasswordHasher,
  RefreshTokenService,
} from './ports';
import {
  AccessTokenClaims,
  AuthenticatedSession,
  CurrentUserView,
  IdentityUser,
  TokenPair,
} from '../domain/identityTypes';

export interface RequestMetadata {
  readonly requestId?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly deviceName?: string;
}

export interface RegisterPatientInput extends RequestMetadata {
  readonly email: string;
  readonly displayName: string;
  readonly password: string;
}

export interface RegisterPsychologistInput extends RegisterPatientInput {
  readonly licenseAuthority: string;
  readonly licenseNumber: string;
}

export interface LoginInput extends RequestMetadata {
  readonly email: string;
  readonly password: string;
}

export interface AuthenticatedActor {
  readonly user: CurrentUserView;
  readonly sessionId: string;
}

interface PreparedSession {
  readonly id: string;
  readonly refreshToken: string;
  readonly refreshTokenHash: string;
  readonly expiresAt: Date;
}

export class IdentityService {
  private readonly dummyPasswordHash: Promise<string>;

  constructor(
    private readonly repository: IdentityRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokens: RefreshTokenService,
    private readonly clock: Clock,
    private readonly refreshTtlDays: number
  ) {
    this.dummyPasswordHash = passwordHasher.hash('invalid-login-candidate-for-timing-equalization');
  }

  async registerPatient(input: RegisterPatientInput): Promise<AuthenticatedSession> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.repository.findUserByEmail(email);
    if (existing) {
      throw AppError.conflict('ACCOUNT_ALREADY_EXISTS', 'No fue posible crear la cuenta con esos datos.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const session = this.prepareSession();
    const user = await this.repository.registerPatient(
      {
        email,
        displayName: input.displayName.trim(),
        passwordHash,
        requestId: input.requestId,
        ipAddress: input.ipAddress,
      },
      this.registrationSessionData(session, input)
    );
    return this.authenticatedSession(user, session);
  }

  async registerPsychologist(input: RegisterPsychologistInput): Promise<AuthenticatedSession> {
    const email = this.normalizeEmail(input.email);
    const existing = await this.repository.findUserByEmail(email);
    if (existing) {
      throw AppError.conflict('ACCOUNT_ALREADY_EXISTS', 'No fue posible crear la cuenta con esos datos.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);
    const session = this.prepareSession();
    const user = await this.repository.registerPsychologist(
      {
        email,
        displayName: input.displayName.trim(),
        passwordHash,
        licenseAuthority: input.licenseAuthority.trim(),
        licenseNumber: input.licenseNumber.trim().toUpperCase(),
        requestId: input.requestId,
        ipAddress: input.ipAddress,
      },
      this.registrationSessionData(session, input)
    );
    return this.authenticatedSession(user, session);
  }

  async login(input: LoginInput): Promise<AuthenticatedSession> {
    const email = this.normalizeEmail(input.email);
    const user = await this.repository.findUserByEmail(email);
    const hashToVerify = user?.passwordHash ?? await this.dummyPasswordHash;
    const verification = await this.passwordHasher.verify(input.password, hashToVerify);

    if (!user || !verification.valid) {
      throw AppError.unauthorized('INVALID_CREDENTIALS');
    }
    if (user.status !== 'ACTIVE') {
      throw AppError.unauthorized('ACCOUNT_UNAVAILABLE');
    }

    if (verification.needsRehash) {
      const upgradedHash = await this.passwordHasher.hash(input.password);
      await this.repository.updatePasswordHash(user.id, upgradedHash);
    }

    return this.createAuthenticatedSession(user, input);
  }

  async refresh(refreshToken: string, requestId?: string): Promise<TokenPair> {
    const parsed = this.refreshTokens.parse(refreshToken);
    const session = await this.repository.findSessionById(parsed.sessionId);
    const now = this.clock.now();

    if (!session || session.revokedAt || session.expiresAt <= now || session.user.status !== 'ACTIVE') {
      throw AppError.unauthorized('INVALID_REFRESH_TOKEN');
    }

    if (!this.refreshTokens.hashesMatch(parsed.hash, session.refreshTokenHash)) {
      await this.repository.revokeSession(
        session.id,
        now,
        'identity.refresh_token_reuse_detected',
        requestId
      );
      throw AppError.unauthorized('INVALID_REFRESH_TOKEN');
    }

    const nextRefreshToken = this.refreshTokens.issue(session.id);
    const rotated = await this.repository.rotateSession(
      session.id,
      session.refreshTokenHash,
      nextRefreshToken.hash,
      now
    );
    if (!rotated) {
      await this.repository.revokeSession(
        session.id,
        now,
        'identity.concurrent_refresh_detected',
        requestId
      );
      throw AppError.unauthorized('INVALID_REFRESH_TOKEN');
    }

    return this.buildTokenPair(session.user, session.id, nextRefreshToken.token, session.expiresAt);
  }

  async authenticateAccessToken(token: string): Promise<AuthenticatedActor> {
    const claims = this.accessTokens.verify(token);
    return this.authenticateClaims(claims);
  }

  async getCurrentUser(userId: string): Promise<CurrentUserView> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.status !== 'ACTIVE') throw AppError.unauthorized();
    return this.toCurrentUser(user);
  }

  async logout(sessionId: string, requestId?: string): Promise<void> {
    await this.repository.revokeSession(sessionId, this.clock.now(), 'identity.session_revoked', requestId);
  }

  async logoutAll(userId: string, requestId?: string): Promise<void> {
    await this.repository.revokeAllSessions(userId, this.clock.now(), undefined, requestId);
  }

  private async authenticateClaims(claims: AccessTokenClaims): Promise<AuthenticatedActor> {
    const session = await this.repository.findSessionById(claims.sessionId);
    const now = this.clock.now();
    if (
      !session
      || session.userId !== claims.userId
      || session.revokedAt
      || session.expiresAt <= now
      || session.user.status !== 'ACTIVE'
    ) {
      throw AppError.unauthorized();
    }
    return { user: this.toCurrentUser(session.user), sessionId: session.id };
  }

  private async createAuthenticatedSession(
    user: IdentityUser,
    metadata: RequestMetadata
  ): Promise<AuthenticatedSession> {
    const session = this.prepareSession();

    await this.repository.createSession({
      id: session.id,
      userId: user.id,
      refreshTokenHash: session.refreshTokenHash,
      deviceName: metadata.deviceName,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt: session.expiresAt,
      requestId: metadata.requestId,
    });

    return this.authenticatedSession(user, session);
  }

  private prepareSession(): PreparedSession {
    const id = randomUUID();
    const issuedRefreshToken = this.refreshTokens.issue(id);
    const expiresAt = new Date(this.clock.now().getTime() + this.refreshTtlDays * 86_400_000);
    return {
      id,
      refreshToken: issuedRefreshToken.token,
      refreshTokenHash: issuedRefreshToken.hash,
      expiresAt,
    };
  }

  private registrationSessionData(session: PreparedSession, metadata: RequestMetadata) {
    return {
      id: session.id,
      refreshTokenHash: session.refreshTokenHash,
      deviceName: metadata.deviceName,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      expiresAt: session.expiresAt,
      requestId: metadata.requestId,
    };
  }

  private authenticatedSession(user: IdentityUser, session: PreparedSession): AuthenticatedSession {
    return {
      user: this.toCurrentUser(user),
      tokens: this.buildTokenPair(user, session.id, session.refreshToken, session.expiresAt),
    };
  }

  private buildTokenPair(
    user: IdentityUser,
    sessionId: string,
    refreshToken: string,
    refreshExpiresAt: Date
  ): TokenPair {
    return {
      accessToken: this.accessTokens.issue({ userId: user.id, sessionId, roles: user.roles }),
      accessTokenExpiresInSeconds: this.accessTokens.expiresInSeconds,
      refreshToken,
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  }

  private toCurrentUser(user: IdentityUser): CurrentUserView {
    const capabilities = new Set<string>(['profile:read:self', 'profile:update:self']);

    if (user.roles.includes('patient')) {
      capabilities.add('psychologist_directory:read');
      capabilities.add('service_request:create');
      capabilities.add('service_request:manage:self');
      capabilities.add('offer:read:self');
      capabilities.add('appointment:read:self');
      capabilities.add('conversation:read:self');
    }

    if (user.roles.includes('psychologist')) {
      capabilities.add('psychologist_onboarding:update:self');
      if (user.psychologistVerificationStatus === 'VERIFIED') {
        capabilities.add('service_request:read:eligible');
        capabilities.add('offer:create:self');
        capabilities.add('offer:manage:self');
        capabilities.add('availability:manage:self');
        capabilities.add('appointment:manage:self');
        capabilities.add('clinical:write:authorized');
      }
    }

    if (user.roles.includes('administrator')) {
      capabilities.add('account:manage');
      capabilities.add('psychologist_verification:manage');
    }
    if (user.roles.includes('clinical_auditor')) {
      capabilities.add('clinical:audit:approved-purpose');
    }

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      photoUrl: user.photoUrl,
      status: user.status,
      roles: [...user.roles],
      psychologistVerificationStatus: user.psychologistVerificationStatus,
      capabilities: [...capabilities].sort(),
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
