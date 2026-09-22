import { IdentitySession, IdentityUser, AccessTokenClaims } from '../domain/identityTypes';

export interface RegisterPatientData {
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface RegisterPsychologistData extends RegisterPatientData {
  readonly licenseAuthority: string;
  readonly licenseNumber: string;
}

export interface CreateSessionData {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly deviceName?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly expiresAt: Date;
  readonly requestId?: string;
}

export interface CreatePasswordResetData {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly requestedAt: Date;
  readonly expiresAt: Date;
  readonly requestedIp?: string;
  readonly requestId?: string;
}

export interface CompletePasswordResetData {
  readonly tokenHash: string;
  readonly passwordHash: string;
  readonly completedAt: Date;
  readonly ipAddress?: string;
  readonly requestId?: string;
}

export type RegistrationSessionData = Omit<CreateSessionData, 'userId'>;

export type FederatedRegistrationRole = 'patient' | 'psychologist';

export interface VerifiedFederatedIdentity {
  readonly provider: 'GOOGLE';
  readonly subject: string;
  readonly email: string;
  readonly emailVerified: true;
  readonly displayName: string;
  readonly photoUrl: string | null;
}

export interface FederatedIdentityVerifier {
  verify(idToken: string): Promise<VerifiedFederatedIdentity>;
}

export interface FederatedAuthenticationData extends RequestMetadataData {
  readonly identity: VerifiedFederatedIdentity;
  readonly authenticatedAt: Date;
  readonly registrationRole?: FederatedRegistrationRole;
  readonly licenseAuthority?: string;
  readonly licenseNumber?: string;
}

export interface RequestMetadataData {
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface IdentityRepository {
  findUserByEmail(email: string): Promise<IdentityUser | null>;
  findUserById(id: string): Promise<IdentityUser | null>;
  findUserByFederatedIdentity(provider: string, subject: string): Promise<IdentityUser | null>;
  registerFederatedUser(data: FederatedAuthenticationData, session: RegistrationSessionData): Promise<IdentityUser>;
  touchFederatedIdentity(provider: string, subject: string, authenticatedAt: Date): Promise<void>;
  registerPatient(data: RegisterPatientData, session: RegistrationSessionData): Promise<IdentityUser>;
  registerPsychologist(data: RegisterPsychologistData, session: RegistrationSessionData): Promise<IdentityUser>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  createSession(data: CreateSessionData): Promise<void>;
  findSessionById(sessionId: string): Promise<IdentitySession | null>;
  rotateSession(sessionId: string, currentHash: string, nextHash: string, now: Date): Promise<boolean>;
  revokeSession(sessionId: string, revokedAt: Date, action?: string, requestId?: string): Promise<void>;
  revokeAllSessions(userId: string, revokedAt: Date, exceptSessionId?: string, requestId?: string): Promise<void>;
  createPasswordReset(data: CreatePasswordResetData): Promise<void>;
  revokePasswordReset(id: string, revokedAt: Date, requestId?: string): Promise<void>;
  completePasswordReset(data: CompletePasswordResetData): Promise<boolean>;
}

export interface PasswordVerification {
  readonly valid: boolean;
  readonly needsRehash: boolean;
}

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, encodedHash: string): Promise<PasswordVerification>;
}

export interface AccessTokenService {
  readonly expiresInSeconds: number;
  issue(claims: AccessTokenClaims): string;
  verify(token: string): AccessTokenClaims;
}

export interface IssuedRefreshToken {
  readonly token: string;
  readonly hash: string;
}

export interface ParsedRefreshToken {
  readonly sessionId: string;
  readonly hash: string;
}

export interface RefreshTokenService {
  issue(sessionId: string): IssuedRefreshToken;
  parse(token: string): ParsedRefreshToken;
  hashesMatch(left: string, right: string): boolean;
}

export interface IssuedPasswordResetToken {
  readonly token: string;
  readonly hash: string;
}

export interface PasswordResetTokenService {
  issue(): IssuedPasswordResetToken;
  hash(token: string): string;
}

export interface PasswordResetDeliveryInput {
  readonly recipientEmail: string;
  readonly displayName: string;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface PasswordResetDelivery {
  send(input: PasswordResetDeliveryInput): Promise<void>;
}
