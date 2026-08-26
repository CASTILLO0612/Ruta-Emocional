import path from 'path';
import dotenv from 'dotenv';

export type RuntimeEnvironment = 'development' | 'test' | 'production';

export interface AppConfig {
  readonly environment: RuntimeEnvironment;
  readonly port: number;
  readonly databaseUrl: string;
  readonly allowedOrigins: readonly string[];
  readonly trustProxy: boolean;
  readonly jsonBodyLimit: string;
  readonly jwt: {
    readonly accessSecret: string;
    readonly issuer: string;
    readonly audience: string;
    readonly accessTtlSeconds: number;
    readonly refreshTtlDays: number;
  };
  readonly password: {
    readonly pepper: string;
    readonly scryptN: number;
    readonly scryptR: number;
    readonly scryptP: number;
    readonly keyLength: number;
  };
  readonly legacyMongo: {
    readonly enabled: boolean;
    readonly uri?: string;
  };
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export function loadEnvironmentFile(): void {
  const envPath = path.resolve(__dirname, '../../.env');
  dotenv.config({ path: envPath });
}

function readRequired(source: NodeJS.ProcessEnv, name: string): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new ConfigurationError(`${name} is required`);
  }
  return value;
}

function readInteger(
  source: NodeJS.ProcessEnv,
  name: string,
  defaultValue: number,
  minimum: number,
  maximum: number
): number {
  const raw = source[name];
  if (raw === undefined || raw.trim() === '') return defaultValue;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ConfigurationError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function readBoolean(source: NodeJS.ProcessEnv, name: string, defaultValue: boolean): boolean {
  const raw = source[name]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new ConfigurationError(`${name} must be true or false`);
}

function readEnvironment(source: NodeJS.ProcessEnv): RuntimeEnvironment {
  const value = source.NODE_ENV?.trim() || 'development';
  if (value !== 'development' && value !== 'test' && value !== 'production') {
    throw new ConfigurationError('NODE_ENV must be development, test, or production');
  }
  return value;
}

function readOrigins(source: NodeJS.ProcessEnv, environment: RuntimeEnvironment): readonly string[] {
  const fallback = environment === 'production'
    ? ''
    : 'http://localhost:8081,http://localhost:19006,http://localhost:8082';
  const origins = (source.ALLOWED_ORIGINS ?? fallback)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (environment === 'production' && origins.length === 0) {
    throw new ConfigurationError('ALLOWED_ORIGINS must contain at least one production origin');
  }
  if (origins.includes('*')) {
    throw new ConfigurationError('ALLOWED_ORIGINS cannot contain a wildcard');
  }

  for (const origin of origins) {
    let parsed: URL;
    try {
      parsed = new URL(origin);
    } catch {
      throw new ConfigurationError(`ALLOWED_ORIGINS contains an invalid URL: ${origin}`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new ConfigurationError(`ALLOWED_ORIGINS contains an unsupported protocol: ${origin}`);
    }
  }

  return Object.freeze([...new Set(origins)]);
}

function assertSecret(name: string, value: string): string {
  if (value.length < 32) {
    throw new ConfigurationError(`${name} must contain at least 32 characters of high-entropy data`);
  }
  if (/replace_me|fallback|changeme|secret/i.test(value)) {
    throw new ConfigurationError(`${name} contains a known placeholder`);
  }
  return value;
}

export function requireJwtAccessSecret(source: NodeJS.ProcessEnv = process.env): string {
  return assertSecret('JWT_ACCESS_SECRET', readRequired(source, 'JWT_ACCESS_SECRET'));
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = readEnvironment(source);
  const legacyEnabled = readBoolean(source, 'ENABLE_LEGACY_MONGO_ROUTES', false);
  const legacyUri = source.MONGO_MIGRATION_URI?.trim() || source.MONGO_URI?.trim();

  if (legacyEnabled && environment === 'production') {
    throw new ConfigurationError('Legacy MongoDB routes cannot be enabled in production');
  }
  if (legacyEnabled && !legacyUri) {
    throw new ConfigurationError('MONGO_MIGRATION_URI is required when legacy MongoDB routes are enabled');
  }

  const config: AppConfig = {
    environment,
    port: readInteger(source, 'PORT', 5000, 1, 65535),
    databaseUrl: readRequired(source, 'DATABASE_URL'),
    allowedOrigins: readOrigins(source, environment),
    trustProxy: readBoolean(source, 'TRUST_PROXY', false),
    jsonBodyLimit: source.JSON_BODY_LIMIT?.trim() || '256kb',
    jwt: {
      accessSecret: requireJwtAccessSecret(source),
      issuer: source.JWT_ISSUER?.trim() || 'ruta-emocional-api',
      audience: source.JWT_AUDIENCE?.trim() || 'ruta-emocional-app',
      accessTtlSeconds: readInteger(source, 'JWT_ACCESS_TTL_SECONDS', 900, 60, 3600),
      refreshTtlDays: readInteger(source, 'JWT_REFRESH_TTL_DAYS', 30, 1, 90),
    },
    password: {
      pepper: assertSecret('PASSWORD_PEPPER', readRequired(source, 'PASSWORD_PEPPER')),
      scryptN: readInteger(source, 'PASSWORD_SCRYPT_N', 32768, 16384, 1048576),
      scryptR: readInteger(source, 'PASSWORD_SCRYPT_R', 8, 1, 32),
      scryptP: readInteger(source, 'PASSWORD_SCRYPT_P', 3, 1, 16),
      keyLength: readInteger(source, 'PASSWORD_SCRYPT_KEY_LENGTH', 64, 32, 128),
    },
    legacyMongo: {
      enabled: legacyEnabled,
      ...(legacyUri ? { uri: legacyUri } : {}),
    },
  };

  return Object.freeze(config);
}
