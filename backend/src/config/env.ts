import path from 'path';
import dotenv from 'dotenv';

export type RuntimeEnvironment = 'development' | 'test' | 'production';

export interface TriageCrisisResourceConfig {
  readonly code: string;
  readonly label: string;
  readonly channel: 'PHONE' | 'URL';
  readonly value: string;
  readonly sourceUrl: string;
  readonly verifiedAt: string;
}

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
  readonly appointments: {
    readonly durationMinutes: number;
    readonly slotIntervalMinutes: number;
    readonly minimumLeadMinutes: number;
    readonly maximumHorizonDays: number;
    readonly patientCancellationNoticeMinutes: number;
    readonly startWindowBeforeMinutes: number;
    readonly maximumCancellationReasonLength: number;
    readonly defaultPageSize: number;
    readonly maximumPageSize: number;
    readonly mutationsPerMinute: number;
    readonly idempotencyTtlHours: number;
    readonly serializableMaxRetries: number;
    readonly serializableRetryBaseDelayMs: number;
    readonly reminderMinutesBefore: readonly number[];
  };
  readonly clinical: {
    readonly contentEncryptionKeys: Readonly<Record<number, string>>;
    readonly activeContentEncryptionKeyVersion: number;
    readonly maximumNoteLength: number;
    readonly maximumEncounterReasonLength: number;
    readonly maximumTreatmentSummaryLength: number;
    readonly maximumGoalLength: number;
    readonly maximumGoalsPerPlan: number;
    readonly minimumAmendmentReasonLength: number;
    readonly maximumAmendmentReasonLength: number;
    readonly maximumEncounterDurationMinutes: number;
    readonly encounterFutureSkewMinutes: number;
    readonly defaultPageSize: number;
    readonly maximumPageSize: number;
    readonly mutationsPerMinute: number;
    readonly idempotencyTtlHours: number;
    readonly serializableMaxRetries: number;
    readonly serializableRetryBaseDelayMs: number;
  };
  readonly triage: {
    readonly enabled: boolean;
    readonly protocolApproved: boolean;
    readonly externalProviderEnabled: boolean;
    readonly evaluatorVersion: string;
    readonly consentDocumentCode: string;
    readonly consentDocumentVersion: string;
    readonly defaultCountryCode: string;
    readonly crisisResources: Readonly<Record<string, readonly TriageCrisisResourceConfig[]>>;
    readonly safetyActions: Readonly<Record<'HIGH' | 'CRITICAL', readonly string[]>>;
    readonly maximumProviderSummaryLength: number;
    readonly assessmentsPerMinute: number;
    readonly idempotencyTtlHours: number;
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

function readPositiveIntegerList(
  source: NodeJS.ProcessEnv,
  name: string,
  defaultValue: string,
  maximumItems: number,
  maximumValue: number
): readonly number[] {
  const raw = source[name]?.trim() || defaultValue;
  const values = raw.split(',').map((value) => Number(value.trim()));
  if (
    values.length === 0
    || values.length > maximumItems
    || values.some((value) => !Number.isInteger(value) || value < 1 || value > maximumValue)
  ) {
    throw new ConfigurationError(
      `${name} must contain between 1 and ${maximumItems} positive integer values`
    );
  }
  return Object.freeze([...new Set(values)].sort((left, right) => right - left));
}

function readCountryCode(source: NodeJS.ProcessEnv, name: string): string {
  const value = readRequired(source, name).toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) {
    throw new ConfigurationError(`${name} must contain an ISO 3166-1 alpha-2 code`);
  }
  return value;
}

function parseJsonObject(source: NodeJS.ProcessEnv, name: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readRequired(source, name));
  } catch {
    throw new ConfigurationError(`${name} must contain valid JSON`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ConfigurationError(`${name} must contain a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function readCrisisResources(
  source: NodeJS.ProcessEnv
): Readonly<Record<string, readonly TriageCrisisResourceConfig[]>> {
  const record = parseJsonObject(source, 'TRIAGE_CRISIS_RESOURCES_JSON');
  const entries = Object.entries(record);
  if (entries.length < 1 || entries.length > 20) {
    throw new ConfigurationError('TRIAGE_CRISIS_RESOURCES_JSON must configure between 1 and 20 countries');
  }

  const result: Record<string, readonly TriageCrisisResourceConfig[]> = {};
  for (const [rawCountryCode, rawResources] of entries) {
    const countryCode = rawCountryCode.toUpperCase();
    if (!/^[A-Z]{2}$/.test(countryCode) || countryCode !== rawCountryCode) {
      throw new ConfigurationError('TRIAGE_CRISIS_RESOURCES_JSON country keys must be uppercase ISO codes');
    }
    if (!Array.isArray(rawResources) || rawResources.length < 1 || rawResources.length > 10) {
      throw new ConfigurationError(`TRIAGE_CRISIS_RESOURCES_JSON.${countryCode} must contain 1 to 10 resources`);
    }

    const codes = new Set<string>();
    result[countryCode] = Object.freeze(rawResources.map((rawResource, index) => {
      if (typeof rawResource !== 'object' || rawResource === null || Array.isArray(rawResource)) {
        throw new ConfigurationError(`TRIAGE_CRISIS_RESOURCES_JSON.${countryCode}[${index}] must be an object`);
      }
      const resource = rawResource as Record<string, unknown>;
      const allowed = ['code', 'label', 'channel', 'value', 'sourceUrl', 'verifiedAt'];
      if (Object.keys(resource).some((key) => !allowed.includes(key))) {
        throw new ConfigurationError(`TRIAGE_CRISIS_RESOURCES_JSON.${countryCode}[${index}] has unknown fields`);
      }
      const code = typeof resource.code === 'string' ? resource.code.trim().toUpperCase() : '';
      const label = typeof resource.label === 'string' ? resource.label.trim() : '';
      const channel = resource.channel;
      const value = typeof resource.value === 'string' ? resource.value.trim() : '';
      const sourceUrl = typeof resource.sourceUrl === 'string' ? resource.sourceUrl.trim() : '';
      const verifiedAt = typeof resource.verifiedAt === 'string' ? resource.verifiedAt.trim() : '';
      if (!/^[A-Z][A-Z0-9_]{2,49}$/.test(code) || codes.has(code)) {
        throw new ConfigurationError(`TRIAGE_CRISIS_RESOURCES_JSON.${countryCode} contains an invalid or repeated code`);
      }
      if (label.length < 3 || label.length > 160 || (channel !== 'PHONE' && channel !== 'URL')) {
        throw new ConfigurationError(`TRIAGE_CRISIS_RESOURCES_JSON.${countryCode}.${code} has invalid display data`);
      }
      if (
        (channel === 'PHONE' && !/^\+?[0-9][0-9 -]{1,30}$/.test(value))
        || (channel === 'URL' && !/^https:\/\//i.test(value))
      ) {
        throw new ConfigurationError(`TRIAGE_CRISIS_RESOURCES_JSON.${countryCode}.${code} has an invalid contact value`);
      }
      try {
        const sourceReference = new URL(sourceUrl);
        if (sourceReference.protocol !== 'https:') throw new Error();
      } catch {
        throw new ConfigurationError(`TRIAGE_CRISIS_RESOURCES_JSON.${countryCode}.${code} requires an HTTPS sourceUrl`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt) || Number.isNaN(Date.parse(`${verifiedAt}T00:00:00Z`))) {
        throw new ConfigurationError(`TRIAGE_CRISIS_RESOURCES_JSON.${countryCode}.${code} has an invalid verifiedAt date`);
      }
      codes.add(code);
      return Object.freeze({ code, label, channel, value, sourceUrl, verifiedAt });
    }));
  }
  return Object.freeze(result);
}

function readTriageSafetyActions(
  source: NodeJS.ProcessEnv
): Readonly<Record<'HIGH' | 'CRITICAL', readonly string[]>> {
  const record = parseJsonObject(source, 'TRIAGE_SAFETY_ACTIONS_JSON');
  if (Object.keys(record).some((key) => key !== 'HIGH' && key !== 'CRITICAL')) {
    throw new ConfigurationError('TRIAGE_SAFETY_ACTIONS_JSON only accepts HIGH and CRITICAL keys');
  }
  const parseActions = (risk: 'HIGH' | 'CRITICAL'): readonly string[] => {
    const raw = record[risk];
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 8) {
      throw new ConfigurationError(`TRIAGE_SAFETY_ACTIONS_JSON.${risk} must contain 1 to 8 actions`);
    }
    const actions = raw.map((action) => typeof action === 'string' ? action.trim() : '');
    if (actions.some((action) => action.length < 10 || action.length > 300)) {
      throw new ConfigurationError(`TRIAGE_SAFETY_ACTIONS_JSON.${risk} contains an invalid action`);
    }
    return Object.freeze([...new Set(actions)]);
  };
  return Object.freeze({ HIGH: parseActions('HIGH'), CRITICAL: parseActions('CRITICAL') });
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

function readBase64KeyRing(
  source: NodeJS.ProcessEnv,
  name: string,
  expectedBytes: number
): Readonly<Record<number, string>> {
  const entries = readRequired(source, name).split(',').map((entry) => entry.trim());
  const keys: Record<number, string> = {};
  for (const entry of entries) {
    const separator = entry.indexOf(':');
    const version = Number(entry.slice(0, separator));
    const value = entry.slice(separator + 1);
    const decoded = Buffer.from(value, 'base64');
    if (
      separator < 1
      || !Number.isInteger(version)
      || version < 1
      || version > 2_147_483_647
      || decoded.length !== expectedBytes
      || decoded.toString('base64') !== value
      || keys[version]
    ) {
      throw new ConfigurationError(
        `${name} must contain unique version:base64 entries encoding ${expectedBytes} bytes`
      );
    }
    keys[version] = value;
  }
  return Object.freeze(keys);
}

export function requireJwtAccessSecret(source: NodeJS.ProcessEnv = process.env): string {
  return assertSecret('JWT_ACCESS_SECRET', readRequired(source, 'JWT_ACCESS_SECRET'));
}

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const environment = readEnvironment(source);
  const localQaEnabled = readBoolean(source, 'ENABLE_LOCAL_QA', false);
  const localQaEvidenceDirectory = source.LOCAL_QA_EVIDENCE_DIRECTORY?.trim() || null;

  if (localQaEnabled && environment !== 'development') {
    throw new ConfigurationError('ENABLE_LOCAL_QA can only be enabled in development');
  }
  if (localQaEnabled && !localQaEvidenceDirectory) {
    throw new ConfigurationError('LOCAL_QA_EVIDENCE_DIRECTORY is required when ENABLE_LOCAL_QA is enabled');
  }

  const supportedCurrencies = readCurrencies(source);
  const triageEnabled = readBoolean(source, 'TRIAGE_ENABLED', false);
  const triageProtocolApproved = readBoolean(source, 'TRIAGE_PROTOCOL_APPROVED', false);
  const triageExternalProviderEnabled = readBoolean(
    source,
    'TRIAGE_EXTERNAL_PROVIDER_ENABLED',
    false
  );
  const triageDefaultCountryCode = readCountryCode(source, 'TRIAGE_DEFAULT_COUNTRY_CODE');
  const triageCrisisResources = readCrisisResources(source);
  const triageSafetyActions = readTriageSafetyActions(source);
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
    appointments: {
      durationMinutes: readRequiredInteger(source, 'APPOINTMENT_DURATION_MINUTES', 15, 240),
      slotIntervalMinutes: readRequiredInteger(source, 'APPOINTMENT_SLOT_INTERVAL_MINUTES', 5, 120),
      minimumLeadMinutes: readRequiredInteger(source, 'APPOINTMENT_MINIMUM_LEAD_MINUTES', 0, 10080),
      maximumHorizonDays: readRequiredInteger(source, 'APPOINTMENT_MAXIMUM_HORIZON_DAYS', 1, 365),
      patientCancellationNoticeMinutes: readRequiredInteger(
        source,
        'APPOINTMENT_PATIENT_CANCELLATION_NOTICE_MINUTES',
        0,
        10080
      ),
      startWindowBeforeMinutes: readRequiredInteger(
        source,
        'APPOINTMENT_START_WINDOW_BEFORE_MINUTES',
        0,
        240
      ),
      maximumCancellationReasonLength: readRequiredInteger(
        source,
        'APPOINTMENT_MAXIMUM_CANCELLATION_REASON_LENGTH',
        20,
        1000
      ),
      defaultPageSize: readRequiredInteger(source, 'APPOINTMENT_DEFAULT_PAGE_SIZE', 1, 100),
      maximumPageSize: readRequiredInteger(source, 'APPOINTMENT_MAXIMUM_PAGE_SIZE', 1, 200),
      mutationsPerMinute: readRequiredInteger(
        source,
        'APPOINTMENT_MUTATIONS_PER_MINUTE',
        1,
        300
      ),
      idempotencyTtlHours: readRequiredInteger(
        source,
        'APPOINTMENT_IDEMPOTENCY_TTL_HOURS',
        1,
        168
      ),
      serializableMaxRetries: readRequiredInteger(
        source,
        'APPOINTMENT_SERIALIZABLE_MAX_RETRIES',
        0,
        5
      ),
      serializableRetryBaseDelayMs: readRequiredInteger(
        source,
        'APPOINTMENT_SERIALIZABLE_RETRY_BASE_DELAY_MS',
        1,
        2000
      ),
      reminderMinutesBefore: readPositiveIntegerList(
        source,
        'APPOINTMENT_REMINDER_MINUTES_BEFORE',
        '1440,60',
        5,
        10080
      ),
    },
    clinical: {
      contentEncryptionKeys: readBase64KeyRing(
        source,
        'CLINICAL_CONTENT_ENCRYPTION_KEYS',
        32
      ),
      activeContentEncryptionKeyVersion: readRequiredInteger(
        source,
        'CLINICAL_ACTIVE_CONTENT_ENCRYPTION_KEY_VERSION',
        1,
        2_147_483_647
      ),
      maximumNoteLength: readRequiredInteger(source, 'CLINICAL_MAXIMUM_NOTE_LENGTH', 100, 100_000),
      maximumEncounterReasonLength: readRequiredInteger(
        source,
        'CLINICAL_MAXIMUM_ENCOUNTER_REASON_LENGTH',
        20,
        500
      ),
      maximumTreatmentSummaryLength: readRequiredInteger(
        source,
        'CLINICAL_MAXIMUM_TREATMENT_SUMMARY_LENGTH',
        100,
        20_000
      ),
      maximumGoalLength: readRequiredInteger(source, 'CLINICAL_MAXIMUM_GOAL_LENGTH', 20, 2_000),
      maximumGoalsPerPlan: readRequiredInteger(source, 'CLINICAL_MAXIMUM_GOALS_PER_PLAN', 1, 50),
      minimumAmendmentReasonLength: readRequiredInteger(
        source,
        'CLINICAL_MINIMUM_AMENDMENT_REASON_LENGTH',
        10,
        200
      ),
      maximumAmendmentReasonLength: readRequiredInteger(
        source,
        'CLINICAL_MAXIMUM_AMENDMENT_REASON_LENGTH',
        20,
        500
      ),
      maximumEncounterDurationMinutes: readRequiredInteger(
        source,
        'CLINICAL_MAXIMUM_ENCOUNTER_DURATION_MINUTES',
        15,
        1_440
      ),
      encounterFutureSkewMinutes: readRequiredInteger(
        source,
        'CLINICAL_ENCOUNTER_FUTURE_SKEW_MINUTES',
        0,
        1_440
      ),
      defaultPageSize: readRequiredInteger(source, 'CLINICAL_DEFAULT_PAGE_SIZE', 1, 100),
      maximumPageSize: readRequiredInteger(source, 'CLINICAL_MAXIMUM_PAGE_SIZE', 1, 200),
      mutationsPerMinute: readRequiredInteger(source, 'CLINICAL_MUTATIONS_PER_MINUTE', 1, 300),
      idempotencyTtlHours: readRequiredInteger(source, 'CLINICAL_IDEMPOTENCY_TTL_HOURS', 1, 168),
      serializableMaxRetries: readRequiredInteger(
        source,
        'CLINICAL_SERIALIZABLE_MAX_RETRIES',
        0,
        5
      ),
      serializableRetryBaseDelayMs: readRequiredInteger(
        source,
        'CLINICAL_SERIALIZABLE_RETRY_BASE_DELAY_MS',
        1,
        2_000
      ),
    },
    triage: {
      enabled: triageEnabled,
      protocolApproved: triageProtocolApproved,
      externalProviderEnabled: triageExternalProviderEnabled,
      evaluatorVersion: readRequired(source, 'TRIAGE_EVALUATOR_VERSION'),
      consentDocumentCode: source.TRIAGE_CONSENT_DOCUMENT_CODE?.trim() || 'MENTA_ORIENTATION',
      consentDocumentVersion: source.TRIAGE_CONSENT_DOCUMENT_VERSION?.trim() || '1.0.0',
      defaultCountryCode: triageDefaultCountryCode,
      crisisResources: triageCrisisResources,
      safetyActions: triageSafetyActions,
      maximumProviderSummaryLength: readRequiredInteger(
        source,
        'TRIAGE_MAXIMUM_PROVIDER_SUMMARY_LENGTH',
        100,
        2_000
      ),
      assessmentsPerMinute: readRequiredInteger(
        source,
        'TRIAGE_ASSESSMENTS_PER_MINUTE',
        1,
        120
      ),
      idempotencyTtlHours: readRequiredInteger(
        source,
        'TRIAGE_IDEMPOTENCY_TTL_HOURS',
        1,
        168
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
  if (config.appointments.defaultPageSize > config.appointments.maximumPageSize) {
    throw new ConfigurationError(
      'APPOINTMENT_DEFAULT_PAGE_SIZE cannot exceed APPOINTMENT_MAXIMUM_PAGE_SIZE'
    );
  }
  if (config.appointments.slotIntervalMinutes > config.appointments.durationMinutes) {
    throw new ConfigurationError(
      'APPOINTMENT_SLOT_INTERVAL_MINUTES cannot exceed APPOINTMENT_DURATION_MINUTES'
    );
  }
  if (config.clinical.defaultPageSize > config.clinical.maximumPageSize) {
    throw new ConfigurationError(
      'CLINICAL_DEFAULT_PAGE_SIZE cannot exceed CLINICAL_MAXIMUM_PAGE_SIZE'
    );
  }
  if (config.clinical.minimumAmendmentReasonLength > config.clinical.maximumAmendmentReasonLength) {
    throw new ConfigurationError(
      'CLINICAL_MINIMUM_AMENDMENT_REASON_LENGTH cannot exceed CLINICAL_MAXIMUM_AMENDMENT_REASON_LENGTH'
    );
  }
  if (!config.clinical.contentEncryptionKeys[config.clinical.activeContentEncryptionKeyVersion]) {
    throw new ConfigurationError(
      'CLINICAL_ACTIVE_CONTENT_ENCRYPTION_KEY_VERSION must reference CLINICAL_CONTENT_ENCRYPTION_KEYS'
    );
  }
  if (!config.triage.crisisResources[config.triage.defaultCountryCode]) {
    throw new ConfigurationError(
      'TRIAGE_DEFAULT_COUNTRY_CODE must have configured crisis resources'
    );
  }
  if (environment === 'production' && config.triage.enabled && !config.triage.protocolApproved) {
    throw new ConfigurationError(
      'TRIAGE_PROTOCOL_APPROVED must be true before enabling MENTA in production'
    );
  }
  if (environment === 'production' && config.triage.externalProviderEnabled) {
    throw new ConfigurationError(
      'External MENTA requires a selected provider adapter and approved data-processing contract'
    );
  }

  return Object.freeze(config);
}
