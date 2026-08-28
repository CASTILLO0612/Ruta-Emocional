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
  readonly professionalDirectory: {
    readonly defaultPageSize: number;
    readonly maxPageSize: number;
    readonly maxRadiusKm: number;
    readonly maxAvailabilityWindowDays: number;
    readonly maxWeeklyRules: number;
    readonly publicRequestsPerMinute: number;
    readonly supportedCurrencies: readonly string[];
  };
  readonly localQa: {
    readonly enabled: boolean;
    readonly evidenceDirectory: string | null;
    readonly evidenceMaximumBytes: number;
    readonly evidenceUploadsPerMinute: number;
  };
  readonly requestFlow: {
    readonly minimumAmount: string;
    readonly maximumAmount: string;
    readonly immediateTtlMinutes: number;
    readonly scheduledLeadMinutes: number;
    readonly scheduledOfferCutoffMinutes: number;
    readonly maximumScheduleDays: number;
    readonly locationRetentionHours: number;
    readonly maximumOpenImmediateRequests: number;
    readonly maximumDescriptionLength: number;
    readonly maximumPrimaryNeedLength: number;
    readonly maximumOfferMessageLength: number;
    readonly defaultPageSize: number;
    readonly maximumPageSize: number;
    readonly idempotencyTtlHours: number;
    readonly expirationBatchSize: number;
    readonly mutationsPerMinute: number;
    readonly serializableMaxRetries: number;
    readonly serializableRetryBaseDelayMs: number;
    readonly supportedCurrencies: readonly string[];
  };
  readonly messaging: {
    readonly maximumTextLength: number;
    readonly defaultPageSize: number;
    readonly maximumPageSize: number;
    readonly messagesPerMinute: number;
    readonly maximumSocketSubscriptions: number;
    readonly socketAuthRevalidationSeconds: number;
    readonly outboxPollIntervalMs: number;
    readonly outboxBatchSize: number;
    readonly outboxClaimTtlSeconds: number;
    readonly outboxMaximumAttempts: number;
    readonly outboxRetryBaseDelayMs: number;
    readonly outboxReadinessMaximumLagSeconds: number;
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

function readRequiredInteger(
  source: NodeJS.ProcessEnv,
  name: string,
  minimum: number,
  maximum: number
): number {
  const raw = readRequired(source, name);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ConfigurationError(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function readRequiredMoney(source: NodeJS.ProcessEnv, name: string): string {
  const value = readRequired(source, name);
  if (!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(value)) {
    throw new ConfigurationError(`${name} must be a positive decimal with at most two decimals`);
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

function readCurrencies(source: NodeJS.ProcessEnv): readonly string[] {
  const values = (source.SUPPORTED_CURRENCIES ?? '')
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (values.length === 0 || values.some((value) => !/^[A-Z]{3}$/.test(value))) {
    throw new ConfigurationError('SUPPORTED_CURRENCIES must contain ISO 4217 three-letter codes');
  }
  return Object.freeze([...new Set(values)]);
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
  const localQaEnabled = readBoolean(source, 'ENABLE_LOCAL_QA', false);
  const legacyUri = source.MONGO_MIGRATION_URI?.trim() || source.MONGO_URI?.trim();
  const localQaEvidenceDirectory = source.LOCAL_QA_EVIDENCE_DIRECTORY?.trim() || null;

  if (legacyEnabled && environment === 'production') {
    throw new ConfigurationError('Legacy MongoDB routes cannot be enabled in production');
  }
  if (legacyEnabled && !legacyUri) {
    throw new ConfigurationError('MONGO_MIGRATION_URI is required when legacy MongoDB routes are enabled');
  }
  if (localQaEnabled && environment !== 'development') {
    throw new ConfigurationError('ENABLE_LOCAL_QA can only be enabled in development');
  }
  if (localQaEnabled && !localQaEvidenceDirectory) {
    throw new ConfigurationError('LOCAL_QA_EVIDENCE_DIRECTORY is required when ENABLE_LOCAL_QA is enabled');
  }

  const supportedCurrencies = readCurrencies(source);
  const minimumRequestAmount = readRequiredMoney(source, 'REQUEST_MINIMUM_AMOUNT');
  const maximumRequestAmount = readRequiredMoney(source, 'REQUEST_MAXIMUM_AMOUNT');
  if (Number(minimumRequestAmount) <= 0 || Number(maximumRequestAmount) <= Number(minimumRequestAmount)) {
    throw new ConfigurationError(
      'REQUEST_MAXIMUM_AMOUNT must be greater than the positive REQUEST_MINIMUM_AMOUNT'
    );
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
    professionalDirectory: {
      defaultPageSize: readInteger(source, 'DIRECTORY_DEFAULT_PAGE_SIZE', 20, 1, 100),
      maxPageSize: readInteger(source, 'DIRECTORY_MAX_PAGE_SIZE', 50, 1, 100),
      maxRadiusKm: readInteger(source, 'DIRECTORY_MAX_RADIUS_KM', 100, 1, 500),
      maxAvailabilityWindowDays: readInteger(
        source,
        'DIRECTORY_MAX_AVAILABILITY_WINDOW_DAYS',
        31,
        1,
        90
      ),
      maxWeeklyRules: readInteger(source, 'DIRECTORY_MAX_WEEKLY_RULES', 50, 1, 100),
      publicRequestsPerMinute: readInteger(
        source,
        'DIRECTORY_PUBLIC_REQUESTS_PER_MINUTE',
        120,
        10,
        1000
      ),
      supportedCurrencies,
    },
    localQa: {
      enabled: localQaEnabled,
      evidenceDirectory: localQaEvidenceDirectory
        ? path.resolve(localQaEvidenceDirectory)
        : null,
      evidenceMaximumBytes: readInteger(
        source,
        'LOCAL_QA_EVIDENCE_MAXIMUM_BYTES',
        5_242_880,
        1_024,
        10_485_760
      ),
      evidenceUploadsPerMinute: readInteger(
        source,
        'LOCAL_QA_EVIDENCE_UPLOADS_PER_MINUTE',
        5,
        1,
        30
      ),
    },
    requestFlow: {
      minimumAmount: minimumRequestAmount,
      maximumAmount: maximumRequestAmount,
      immediateTtlMinutes: readRequiredInteger(
        source,
        'REQUEST_IMMEDIATE_TTL_MINUTES',
        5,
        1440
      ),
      scheduledLeadMinutes: readRequiredInteger(
        source,
        'REQUEST_SCHEDULED_LEAD_MINUTES',
        15,
        10080
      ),
      scheduledOfferCutoffMinutes: readRequiredInteger(
        source,
        'REQUEST_SCHEDULED_OFFER_CUTOFF_MINUTES',
        5,
        1440
      ),
      maximumScheduleDays: readRequiredInteger(
        source,
        'REQUEST_MAXIMUM_SCHEDULE_DAYS',
        1,
        365
      ),
      locationRetentionHours: readRequiredInteger(
        source,
        'REQUEST_LOCATION_RETENTION_HOURS',
        1,
        720
      ),
      maximumOpenImmediateRequests: readRequiredInteger(
        source,
        'REQUEST_MAXIMUM_OPEN_IMMEDIATE',
        1,
        10
      ),
      maximumDescriptionLength: readRequiredInteger(
        source,
        'REQUEST_MAXIMUM_DESCRIPTION_LENGTH',
        100,
        5000
      ),
      maximumPrimaryNeedLength: readRequiredInteger(
        source,
        'REQUEST_MAXIMUM_PRIMARY_NEED_LENGTH',
        20,
        240
      ),
      maximumOfferMessageLength: readRequiredInteger(
        source,
        'REQUEST_MAXIMUM_OFFER_MESSAGE_LENGTH',
        20,
        500
      ),
      defaultPageSize: readRequiredInteger(source, 'REQUEST_DEFAULT_PAGE_SIZE', 1, 100),
      maximumPageSize: readRequiredInteger(source, 'REQUEST_MAXIMUM_PAGE_SIZE', 1, 100),
      idempotencyTtlHours: readRequiredInteger(
        source,
        'REQUEST_IDEMPOTENCY_TTL_HOURS',
        1,
        168
      ),
      expirationBatchSize: readRequiredInteger(
        source,
        'REQUEST_EXPIRATION_BATCH_SIZE',
        10,
        1000
      ),
      mutationsPerMinute: readRequiredInteger(
        source,
        'REQUEST_MUTATIONS_PER_MINUTE',
        5,
        300
      ),
      serializableMaxRetries: readRequiredInteger(
        source,
        'REQUEST_SERIALIZABLE_MAX_RETRIES',
        0,
        5
      ),
      serializableRetryBaseDelayMs: readRequiredInteger(
        source,
        'REQUEST_SERIALIZABLE_RETRY_BASE_DELAY_MS',
        1,
        2000
      ),
      supportedCurrencies,
    },
    messaging: {
      maximumTextLength: readRequiredInteger(source, 'MESSAGE_MAXIMUM_TEXT_LENGTH', 1, 4000),
      defaultPageSize: readRequiredInteger(source, 'MESSAGE_DEFAULT_PAGE_SIZE', 1, 100),
      maximumPageSize: readRequiredInteger(source, 'MESSAGE_MAXIMUM_PAGE_SIZE', 1, 200),
      messagesPerMinute: readRequiredInteger(source, 'MESSAGE_MUTATIONS_PER_MINUTE', 1, 600),
      maximumSocketSubscriptions: readRequiredInteger(
        source,
        'MESSAGE_MAXIMUM_SOCKET_SUBSCRIPTIONS',
        1,
        200
      ),
      socketAuthRevalidationSeconds: readRequiredInteger(
        source,
        'SOCKET_AUTH_REVALIDATION_SECONDS',
        15,
        300
      ),
      outboxPollIntervalMs: readRequiredInteger(source, 'OUTBOX_POLL_INTERVAL_MS', 50, 60_000),
      outboxBatchSize: readRequiredInteger(source, 'OUTBOX_BATCH_SIZE', 1, 500),
      outboxClaimTtlSeconds: readRequiredInteger(source, 'OUTBOX_CLAIM_TTL_SECONDS', 5, 600),
      outboxMaximumAttempts: readRequiredInteger(source, 'OUTBOX_MAXIMUM_ATTEMPTS', 1, 100),
      outboxRetryBaseDelayMs: readRequiredInteger(
        source,
        'OUTBOX_RETRY_BASE_DELAY_MS',
        10,
        60_000
      ),
      outboxReadinessMaximumLagSeconds: readRequiredInteger(
        source,
        'OUTBOX_READINESS_MAXIMUM_LAG_SECONDS',
        30,
        86_400
      ),
    },
  };

  if (config.requestFlow.scheduledOfferCutoffMinutes >= config.requestFlow.scheduledLeadMinutes) {
    throw new ConfigurationError(
      'REQUEST_SCHEDULED_OFFER_CUTOFF_MINUTES must be lower than REQUEST_SCHEDULED_LEAD_MINUTES'
    );
  }
  if (config.requestFlow.defaultPageSize > config.requestFlow.maximumPageSize) {
    throw new ConfigurationError(
      'REQUEST_DEFAULT_PAGE_SIZE cannot exceed REQUEST_MAXIMUM_PAGE_SIZE'
    );
  }
  if (config.messaging.defaultPageSize > config.messaging.maximumPageSize) {
    throw new ConfigurationError(
      'MESSAGE_DEFAULT_PAGE_SIZE cannot exceed MESSAGE_MAXIMUM_PAGE_SIZE'
    );
  }
  if (config.messaging.outboxClaimTtlSeconds * 1000 <= config.messaging.outboxPollIntervalMs) {
    throw new ConfigurationError(
      'OUTBOX_CLAIM_TTL_SECONDS must exceed OUTBOX_POLL_INTERVAL_MS'
    );
  }

  return Object.freeze(config);
}
