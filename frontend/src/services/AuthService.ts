import { ApiError, apiV1Request, configureAuthRefresh, setAuthToken } from './apiClient';
import { deleteRefreshToken, readRefreshToken, writeRefreshToken } from './secureSessionStorage';
import { disconnectSocket } from './socketClient';

export type UserRole = 'patient' | 'psychologist';
export type RoleCode = UserRole | 'administrator' | 'clinical_auditor';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export const PSYCHOLOGIST_LICENSE_AUTHORITY = 'MINSA';

export interface CurrentUser {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
  readonly photoUrl: string | null;
  readonly status: AccountStatus;
  readonly roles: readonly RoleCode[];
  readonly psychologistVerificationStatus: VerificationStatus | null;
  readonly capabilities: readonly string[];
}

export interface TokenPair {
  readonly accessToken: string;
  readonly accessTokenExpiresInSeconds: number;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
}

interface AuthenticatedSession {
  readonly user: CurrentUser;
  readonly tokens: TokenPair;
}

export interface RegisterUserInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly role: UserRole;
  readonly license?: {
    readonly authority: string;
    readonly number: string;
  };
}

type SessionInvalidHandler = () => void;

const ROLE_CODES = new Set<RoleCode>([
  'patient',
  'psychologist',
  'administrator',
  'clinical_auditor',
]);
const ACCOUNT_STATUSES = new Set<AccountStatus>(['ACTIVE', 'SUSPENDED', 'DISABLED']);
const VERIFICATION_STATUSES = new Set<VerificationStatus>(['PENDING', 'VERIFIED', 'REJECTED']);

let refreshInFlight: Promise<string | null> | null = null;
let sessionInvalidHandler: SessionInvalidHandler | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isCurrentUser(value: unknown): value is CurrentUser {
  if (!isRecord(value)) return false;
  const roles = value.roles;
  const verificationStatus = value.psychologistVerificationStatus;
  return typeof value.id === 'string'
    && typeof value.displayName === 'string'
    && typeof value.email === 'string'
    && (typeof value.photoUrl === 'string' || value.photoUrl === null)
    && typeof value.status === 'string'
    && ACCOUNT_STATUSES.has(value.status as AccountStatus)
    && isStringArray(roles)
    && roles.length > 0
    && roles.every((role) => ROLE_CODES.has(role as RoleCode))
    && (
      verificationStatus === null
      || (typeof verificationStatus === 'string'
        && VERIFICATION_STATUSES.has(verificationStatus as VerificationStatus))
    )
    && isStringArray(value.capabilities);
}

function isTokenPair(value: unknown): value is TokenPair {
  if (!isRecord(value)) return false;
  return typeof value.accessToken === 'string'
    && value.accessToken.length > 0
    && typeof value.accessTokenExpiresInSeconds === 'number'
    && Number.isFinite(value.accessTokenExpiresInSeconds)
    && value.accessTokenExpiresInSeconds > 0
    && typeof value.refreshToken === 'string'
    && value.refreshToken.length > 0
    && typeof value.refreshTokenExpiresAt === 'string'
    && !Number.isNaN(Date.parse(value.refreshTokenExpiresAt));
}

function envelopeData(payload: unknown): unknown {
  if (!isRecord(payload) || !('data' in payload)) {
    throw invalidResponseError();
  }
  return payload.data;
}

function readCurrentUser(payload: unknown): CurrentUser {
  const user = envelopeData(payload);
  if (!isCurrentUser(user)) throw invalidResponseError();
  return user;
}

function readTokenPair(payload: unknown): TokenPair {
  const tokens = envelopeData(payload);
  if (!isTokenPair(tokens)) throw invalidResponseError();
  return tokens;
}

function readAuthenticatedSession(payload: unknown): AuthenticatedSession {
  const data = envelopeData(payload);
  if (!isRecord(data) || !isCurrentUser(data.user) || !isTokenPair(data.tokens)) {
    throw invalidResponseError();
  }
  return { user: data.user, tokens: data.tokens };
}

function invalidResponseError(): ApiError {
  return new ApiError({
    status: 502,
    code: 'INVALID_API_RESPONSE',
    message: 'El servidor devolvió datos de sesión incompletos.',
  });
}

async function persistTokenPair(tokens: TokenPair): Promise<void> {
  try {
    await writeRefreshToken(tokens.refreshToken);
    setAuthToken(tokens.accessToken);
  } catch (cause) {
    setAuthToken(null);
    throw new ApiError({
      status: 0,
      code: 'SESSION_STORAGE_ERROR',
      message: 'No pudimos proteger la sesión en este dispositivo.',
      cause,
    });
  }
}

async function invalidateLocalSession(): Promise<void> {
  setAuthToken(null);
  disconnectSocket();
  try {
    await deleteRefreshToken();
  } finally {
    sessionInvalidHandler?.();
  }
}

async function invalidateLocalSessionSafely(): Promise<void> {
  try {
    await invalidateLocalSession();
  } catch {
    // El estado se limpia en el bloque finally aunque el sistema operativo no pueda borrar la clave.
  }
}

async function performRefresh(): Promise<string | null> {
  const storedRefreshToken = await readRefreshToken();
  if (!storedRefreshToken) {
    await invalidateLocalSessionSafely();
    return null;
  }

  let payload: unknown;
  try {
    payload = await apiV1Request<unknown>(
      '/auth/refresh',
      'POST',
      { refreshToken: storedRefreshToken },
      { authenticated: false, retryUnauthorized: false }
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await invalidateLocalSessionSafely();
      return null;
    }
    throw error;
  }

  let tokens: TokenPair;
  try {
    tokens = readTokenPair(payload);
    await persistTokenPair(tokens);
  } catch (error) {
    await invalidateLocalSessionSafely();
    throw error;
  }
  return tokens.accessToken;
}

export function setSessionInvalidHandler(handler: SessionInvalidHandler): void {
  sessionInvalidHandler = handler;
}

export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export async function registerUser(input: RegisterUserInput): Promise<CurrentUser> {
  if (input.role === 'psychologist' && !input.license) {
    throw new ApiError({
      status: 422,
      code: 'LICENSE_REQUIRED',
      message: 'La licencia profesional es obligatoria para crear esta cuenta.',
    });
  }

  const endpoint = input.role === 'patient'
    ? '/auth/register/patient'
    : '/auth/register/psychologist';
  const requestBody = input.role === 'patient'
    ? {
        displayName: input.displayName,
        email: input.email,
        password: input.password,
      }
    : {
        displayName: input.displayName,
        email: input.email,
        password: input.password,
        license: input.license,
      };

  const payload = await apiV1Request<unknown>(endpoint, 'POST', requestBody, {
    authenticated: false,
    retryUnauthorized: false,
  });
  const session = readAuthenticatedSession(payload);
  try {
    await persistTokenPair(session.tokens);
  } catch (error) {
    await invalidateLocalSessionSafely();
    throw error;
  }
  return session.user;
}

export async function signIn(email: string, password: string): Promise<CurrentUser> {
  const payload = await apiV1Request<unknown>(
    '/auth/login',
    'POST',
    { email, password },
    { authenticated: false, retryUnauthorized: false }
  );
  const session = readAuthenticatedSession(payload);
  try {
    await persistTokenPair(session.tokens);
  } catch (error) {
    await invalidateLocalSessionSafely();
    throw error;
  }
  return session.user;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const payload = await apiV1Request<unknown>('/auth/me');
  return readCurrentUser(payload);
}

export async function restoreSession(): Promise<CurrentUser | null> {
  const accessToken = await refreshAccessToken();
  if (!accessToken) return null;

  try {
    const payload = await apiV1Request<unknown>('/auth/me', 'GET', undefined, {
      retryUnauthorized: false,
    });
    return readCurrentUser(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await invalidateLocalSessionSafely();
      return null;
    }
    throw error;
  }
}

async function revokeSession(endpoint: '/auth/logout' | '/auth/logout-all'): Promise<void> {
  let remoteError: unknown;
  try {
    await apiV1Request<void>(endpoint, 'POST');
  } catch (error) {
    remoteError = error;
  } finally {
    await invalidateLocalSessionSafely();
  }
  if (remoteError) throw remoteError;
}

export function signOutUser(): Promise<void> {
  return revokeSession('/auth/logout');
}

export function signOutAllSessions(): Promise<void> {
  return revokeSession('/auth/logout-all');
}

configureAuthRefresh(refreshAccessToken);
