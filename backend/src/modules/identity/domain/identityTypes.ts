export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
export type RoleCode = 'patient' | 'psychologist' | 'administrator' | 'clinical_auditor';

export interface IdentityUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly photoUrl: string | null;
  readonly status: AccountStatus;
  readonly roles: readonly RoleCode[];
  readonly patientProfileId: string | null;
  readonly psychologistProfileId: string | null;
  readonly psychologistVerificationStatus: VerificationStatus | null;
}

export interface CurrentUserView {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly status: AccountStatus;
  readonly roles: readonly RoleCode[];
  readonly psychologistVerificationStatus: VerificationStatus | null;
  readonly capabilities: readonly string[];
}

export interface IdentitySession {
  readonly id: string;
  readonly userId: string;
  readonly refreshTokenHash: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly user: IdentityUser;
}

export interface AccessTokenClaims {
  readonly userId: string;
  readonly sessionId: string;
  readonly roles: readonly RoleCode[];
}

export interface TokenPair {
  readonly accessToken: string;
  readonly accessTokenExpiresInSeconds: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
}

export interface AuthenticatedSession {
  readonly user: CurrentUserView;
  readonly tokens: TokenPair;
}
