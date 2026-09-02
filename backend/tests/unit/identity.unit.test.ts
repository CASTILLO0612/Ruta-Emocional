import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { AppConfig, ConfigurationError, loadConfig } from '../../src/config/env';
import { Clock } from '../../src/shared/application/clock';
import { AppError } from '../../src/shared/domain/appError';
import { IdentityService } from '../../src/modules/identity/application/identityService';
import {
  AccessTokenService,
  CreateSessionData,
  IdentityRepository,
  PasswordHasher,
  PasswordVerification,
  RegisterPatientData,
  RegisterPsychologistData,
  RegistrationSessionData,
} from '../../src/modules/identity/application/ports';
import {
  AccessTokenClaims,
  IdentitySession,
  IdentityUser,
} from '../../src/modules/identity/domain/identityTypes';
import { JwtAccessTokenService } from '../../src/modules/identity/infrastructure/security/jwtAccessTokenService';
import { OpaqueRefreshTokenService } from '../../src/modules/identity/infrastructure/security/opaqueRefreshTokenService';
import { ScryptPasswordHasher } from '../../src/modules/identity/infrastructure/security/scryptPasswordHasher';
import { parsePatientRegistration } from '../../src/modules/identity/presentation/identityValidation';

class FixedClock implements Clock {
  constructor(public current = new Date('2026-08-25T12:00:00.000Z')) {}
  now(): Date { return new Date(this.current); }
}

class FastPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> { return `hash:${password}`; }
  async verify(password: string, encodedHash: string): Promise<PasswordVerification> {
    return { valid: encodedHash === `hash:${password}`, needsRehash: false };
  }
}

class FakeAccessTokens implements AccessTokenService {
  readonly expiresInSeconds = 900;
  issue(claims: AccessTokenClaims): string {
    return Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  }
  verify(token: string): AccessTokenClaims {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as AccessTokenClaims;
  }
}

class InMemoryIdentityRepository implements IdentityRepository {
  readonly users = new Map<string, IdentityUser>();
  readonly sessions = new Map<string, IdentitySession>();

  async findUserByEmail(email: string): Promise<IdentityUser | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null;
  }
  async findUserById(id: string): Promise<IdentityUser | null> {
    return this.users.get(id) ?? null;
  }
  async registerPatient(data: RegisterPatientData, session: RegistrationSessionData): Promise<IdentityUser> {
    const user = this.user(data, ['patient'], null);
    this.users.set(user.id, user);
    this.addRegistrationSession(user, session);
    return user;
  }
  async registerPsychologist(
    data: RegisterPsychologistData,
    session: RegistrationSessionData
  ): Promise<IdentityUser> {
    const user = this.user(data, ['psychologist'], 'PENDING');
    this.users.set(user.id, user);
    this.addRegistrationSession(user, session);
    return user;
  }
  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) this.users.set(userId, { ...user, passwordHash });
  }
  async createSession(data: CreateSessionData): Promise<void> {
    const user = this.users.get(data.userId)!;
    this.sessions.set(data.id, {
      id: data.id,
      userId: data.userId,
      refreshTokenHash: data.refreshTokenHash,
      expiresAt: data.expiresAt,
      revokedAt: null,
      user,
    });
  }
  async findSessionById(sessionId: string): Promise<IdentitySession | null> {
    return this.sessions.get(sessionId) ?? null;
  }
  async rotateSession(sessionId: string, currentHash: string, nextHash: string, now: Date): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.revokedAt || session.expiresAt <= now || session.refreshTokenHash !== currentHash) {
      return false;
    }
    this.sessions.set(sessionId, { ...session, refreshTokenHash: nextHash });
    return true;
  }
  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session && !session.revokedAt) this.sessions.set(sessionId, { ...session, revokedAt });
  }
  async revokeAllSessions(userId: string, revokedAt: Date, exceptSessionId?: string): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.userId === userId && id !== exceptSessionId && !session.revokedAt) {
        this.sessions.set(id, { ...session, revokedAt });
      }
    }
  }

  private user(
    data: RegisterPatientData,
    roles: IdentityUser['roles'],
    psychologistVerificationStatus: IdentityUser['psychologistVerificationStatus']
  ): IdentityUser {
    const id = `00000000-0000-4000-8000-${String(this.users.size + 1).padStart(12, '0')}`;
    return {
      id,
      email: data.email,
      displayName: data.displayName,
      passwordHash: data.passwordHash,
      photoUrl: null,
      status: 'ACTIVE',
      roles,
      patientProfileId: roles.includes('patient') ? id : null,
      psychologistProfileId: roles.includes('psychologist') ? id : null,
      psychologistVerificationStatus,
    };
  }

  private addRegistrationSession(user: IdentityUser, session: RegistrationSessionData): void {
    this.sessions.set(session.id, {
      id: session.id,
      userId: user.id,
      refreshTokenHash: session.refreshTokenHash,
      expiresAt: session.expiresAt,
      revokedAt: null,
      user,
    });
  }
}

function buildIdentity() {
  const repository = new InMemoryIdentityRepository();
  const clock = new FixedClock();
  const service = new IdentityService(
    repository,
    new FastPasswordHasher(),
    new FakeAccessTokens(),
    new OpaqueRefreshTokenService(),
    clock,
    30
  );
  return { repository, clock, service };
}

test('patient registration normalizes identity and creates a revocable session', async () => {
  const { repository, service } = buildIdentity();
  const result = await service.registerPatient({
    displayName: '  Ana Pérez  ',
    email: '  ANA@EXAMPLE.COM ',
    password: 'a-long-test-passphrase',
  });

  assert.equal(result.user.email, 'ana@example.com');
  assert.equal(result.user.displayName, 'Ana Pérez');
  assert.deepEqual(result.user.roles, ['patient']);
  assert.ok(result.user.capabilities.includes('service_request:create'));
  assert.equal(repository.sessions.size, 1);
  assert.equal(result.tokens.refreshToken.split('.')[0], [...repository.sessions.keys()][0]);
});

test('psychologist remains limited while verification is pending', async () => {
  const { service } = buildIdentity();
  const result = await service.registerPsychologist({
    displayName: 'María Psicóloga',
    email: 'maria@example.com',
    password: 'another-long-test-passphrase',
    licenseAuthority: 'MINSA',
    licenseNumber: 'MINSA-1234',
  });

  assert.equal(result.user.psychologistVerificationStatus, 'PENDING');
  assert.ok(result.user.capabilities.includes('psychologist_onboarding:update:self'));
  assert.ok(!result.user.capabilities.includes('offer:create:self'));
});

test('refresh rotation rejects replay and revokes the token family', async () => {
  const { repository, service } = buildIdentity();
  const registered = await service.registerPatient({
    displayName: 'Ana Pérez',
    email: 'ana@example.com',
    password: 'a-long-test-passphrase',
  });
  const firstRefresh = registered.tokens.refreshToken;
  const rotated = await service.refresh(firstRefresh);
  assert.notEqual(rotated.refreshToken, firstRefresh);

  await assert.rejects(
    () => service.refresh(firstRefresh),
    (error: unknown) => error instanceof AppError && error.code === 'INVALID_REFRESH_TOKEN'
  );
  const session = [...repository.sessions.values()][0];
  assert.ok(session.revokedAt);
  await assert.rejects(
    () => service.authenticateAccessToken(rotated.accessToken),
    (error: unknown) => error instanceof AppError && error.status === 401
  );
});

test('registration validation rejects weak passwords and extra authority fields', () => {
  assert.throws(
    () => parsePatientRegistration({
      displayName: 'Ana Pérez',
      email: 'ana@example.com',
      password: 'short',
      role: 'administrator',
    }),
    (error: unknown) => {
      if (!(error instanceof AppError)) return false;
      const codes = error.errors?.map((item) => item.code) ?? [];
      return codes.includes('WEAK_PASSWORD') && codes.includes('UNKNOWN_FIELD');
    }
  );
});

test('configuration fails closed for placeholders and wildcard origins', () => {
  const base: NodeJS.ProcessEnv = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://app@example.invalid/database',
    JWT_ACCESS_SECRET: 'a'.repeat(40),
    PASSWORD_PEPPER: 'b'.repeat(40),
    ALLOWED_ORIGINS: '*',
  };
  assert.throws(() => loadConfig(base), ConfigurationError);
  assert.throws(
    () => loadConfig({ ...base, ALLOWED_ORIGINS: 'https://app.example.com', JWT_ACCESS_SECRET: 'replace_me'.repeat(5) }),
    ConfigurationError
  );
  assert.throws(
    () => loadConfig({
      ...base,
      ALLOWED_ORIGINS: 'https://app.example.com',
      ENABLE_LOCAL_QA: 'true',
      LOCAL_QA_EVIDENCE_DIRECTORY: './var/private/professional-evidence',
    }),
    ConfigurationError
  );
});

test('scrypt hashes passwords and upgrades a valid legacy bcrypt hash', async () => {
  const hasher = new ScryptPasswordHasher({
    pepper: 'test-pepper-with-at-least-thirty-two-characters',
    n: 16_384,
    r: 8,
    p: 1,
    keyLength: 32,
  });
  const encoded = await hasher.hash('correct horse battery staple');
  assert.equal((await hasher.verify('correct horse battery staple', encoded)).valid, true);
  assert.equal((await hasher.verify('incorrect', encoded)).valid, false);

  const legacy = await bcrypt.hash('legacy-password', 4);
  assert.deepEqual(await hasher.verify('legacy-password', legacy), { valid: true, needsRehash: true });
});

test('JWT validates issuer, audience and role allowlist', () => {
  const tokens = new JwtAccessTokenService({
    secret: 'jwt-test-secret-with-at-least-thirty-two-characters',
    issuer: 'ruta-emocional-api-test',
    audience: 'ruta-emocional-app-test',
    expiresInSeconds: 900,
  });
  const token = tokens.issue({
    userId: '00000000-0000-4000-8000-000000000001',
    sessionId: '00000000-0000-4000-8000-000000000002',
    roles: ['patient'],
  });
  assert.deepEqual(tokens.verify(token).roles, ['patient']);
  assert.throws(() => tokens.verify(`${token}tampered`), AppError);
});
