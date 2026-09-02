export class ProductionReadinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductionReadinessError';
  }
}

interface ProductionReadinessConfig {
  readonly environment: 'development' | 'test' | 'production';
  readonly databaseUrl: string;
  readonly secrets: {
    readonly source: 'LOCAL_ENV' | 'EXTERNAL_INJECTION';
    readonly bundleVersion: string | null;
  };
  readonly operations: {
    readonly runtimeDatabaseRole: string | null;
    readonly backupProvider: string | null;
    readonly lastRestoreVerifiedAt: string | null;
    readonly maximumRestoreAgeDays: number;
    readonly rpoMinutes: number;
    readonly rtoMinutes: number;
    readonly observabilityProvider: string | null;
    readonly alertingEnabled: boolean;
  };
  readonly triage: {
    readonly enabled: boolean;
    readonly protocolApproved: boolean;
    readonly externalProviderEnabled: boolean;
    readonly evaluatorVersion: string;
    readonly consentDocumentCode: string;
    readonly consentDocumentVersion: string;
    readonly protocolApproval: {
      readonly approvalId: string;
      readonly evaluatorVersion: string;
      readonly consentDocumentCode: string;
      readonly consentDocumentVersion: string;
      readonly reviewerRegistration: string;
      readonly artifactSha256: string;
      readonly approvedAt: string;
      readonly expiresAt: string;
    } | null;
    readonly retentionPolicy: {
      readonly approved: boolean;
      readonly version: string;
      readonly assessmentRetentionDays: number;
      readonly erasureRequestSlaBusinessDays: number;
    };
    readonly crisisResources: Readonly<Record<string, readonly {
      readonly code: string;
      readonly verifiedAt: string;
      readonly reviewDueAt: string;
      readonly owner: string;
    }[]>>;
  };
  readonly menta: {
    readonly enabled: boolean;
    readonly provider: 'DISABLED' | 'GEMINI';
    readonly externalProviderApproved: boolean;
    readonly retentionPolicyApproved: boolean;
    readonly conversationRetentionDays: number;
  };
}

const PRIVILEGED_DATABASE_USERS = new Set([
  'postgres',
  'rdsadmin',
  'cloudsqladmin',
  'azure_pg_admin',
  'supabase_admin',
]);

function instant(value: string | null, name: string): number {
  const parsed = value ? Date.parse(value) : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new ProductionReadinessError(`${name} must contain a valid ISO-8601 instant`);
  }
  return parsed;
}

function validateDatabaseIdentity(databaseUrl: string): void {
  let username: string;
  try {
    username = decodeURIComponent(new URL(databaseUrl).username).toLowerCase();
  } catch {
    throw new ProductionReadinessError('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!username || PRIVILEGED_DATABASE_USERS.has(username)) {
    throw new ProductionReadinessError(
      'Production DATABASE_URL must use a dedicated least-privilege application login'
    );
  }
}

function validateTriage(config: ProductionReadinessConfig, nowMs: number): void {
  if (!config.triage.enabled) return;
  if (!config.triage.protocolApproved || !config.triage.protocolApproval) {
    throw new ProductionReadinessError(
      'MENTA requires a traceable professional protocol approval before production'
    );
  }
  const approval = config.triage.protocolApproval;
  if (
    approval.evaluatorVersion !== config.triage.evaluatorVersion
    || approval.consentDocumentCode !== config.triage.consentDocumentCode
    || approval.consentDocumentVersion !== config.triage.consentDocumentVersion
  ) {
    throw new ProductionReadinessError(
      'MENTA protocol approval does not match the active evaluator and consent versions'
    );
  }
  if (instant(approval.approvedAt, 'TRIAGE protocol approvedAt') > nowMs) {
    throw new ProductionReadinessError('MENTA protocol approval cannot be dated in the future');
  }
  if (instant(approval.expiresAt, 'TRIAGE protocol expiresAt') <= nowMs) {
    throw new ProductionReadinessError('MENTA protocol approval is expired');
  }
  if (!config.triage.retentionPolicy.approved) {
    throw new ProductionReadinessError('MENTA requires an approved retention policy');
  }
  if (
    config.triage.retentionPolicy.assessmentRetentionDays < 1
    || config.triage.retentionPolicy.erasureRequestSlaBusinessDays < 1
    || config.triage.retentionPolicy.erasureRequestSlaBusinessDays > 5
  ) {
    throw new ProductionReadinessError(
      'MENTA retention must be positive and privacy requests must be answered within five business days'
    );
  }
  for (const resources of Object.values(config.triage.crisisResources)) {
    for (const resource of resources) {
      if (!resource.owner.trim()) {
        throw new ProductionReadinessError(`Crisis resource ${resource.code} requires an owner`);
      }
      if (instant(`${resource.verifiedAt}T00:00:00Z`, `${resource.code}.verifiedAt`) > nowMs) {
        throw new ProductionReadinessError(`Crisis resource ${resource.code} has a future verification`);
      }
      if (instant(`${resource.reviewDueAt}T23:59:59Z`, `${resource.code}.reviewDueAt`) <= nowMs) {
        throw new ProductionReadinessError(`Crisis resource ${resource.code} requires review`);
      }
    }
  }
  if (config.triage.externalProviderEnabled) {
    throw new ProductionReadinessError(
      'External MENTA is not approved for the MVP; use the deterministic engine'
    );
  }
}

function validateMentaAgent(config: ProductionReadinessConfig): void {
  if (!config.menta.enabled) return;
  if (!config.triage.enabled) {
    throw new ProductionReadinessError(
      'The MENTA agent requires the deterministic safety protocol to remain enabled'
    );
  }
  if (config.menta.provider === 'DISABLED') {
    throw new ProductionReadinessError('The production MENTA agent requires an approved AI provider');
  }
  if (!config.menta.externalProviderApproved) {
    throw new ProductionReadinessError(
      'The external MENTA provider requires explicit privacy and clinical approval'
    );
  }
  if (!config.menta.retentionPolicyApproved || config.menta.conversationRetentionDays < 1) {
    throw new ProductionReadinessError(
      'MENTA conversations require an approved positive retention policy'
    );
  }
}

export function assertProductionReadiness(
  config: ProductionReadinessConfig,
  now: Date = new Date()
): void {
  if (config.environment !== 'production') return;

  validateDatabaseIdentity(config.databaseUrl);
  if (config.secrets.source !== 'EXTERNAL_INJECTION' || !config.secrets.bundleVersion) {
    throw new ProductionReadinessError(
      'Production secrets must be externally injected from a versioned bundle'
    );
  }
  if (!config.operations.backupProvider || !config.operations.observabilityProvider) {
    throw new ProductionReadinessError(
      'Production backup and observability providers must be identified'
    );
  }
  if (!config.operations.runtimeDatabaseRole) {
    throw new ProductionReadinessError('Production PostgreSQL runtime role must be identified');
  }
  if (!config.operations.alertingEnabled) {
    throw new ProductionReadinessError('Production alerting must be enabled');
  }
  const lastRestoreMs = instant(
    config.operations.lastRestoreVerifiedAt,
    'BACKUP_LAST_RESTORE_VERIFIED_AT'
  );
  const maximumRestoreAgeMs = config.operations.maximumRestoreAgeDays * 86_400_000;
  if (lastRestoreMs > now.getTime() || now.getTime() - lastRestoreMs > maximumRestoreAgeMs) {
    throw new ProductionReadinessError(
      'The last production restore verification is missing, future-dated, or stale'
    );
  }
  if (config.operations.rpoMinutes < 1 || config.operations.rtoMinutes < 1) {
    throw new ProductionReadinessError('Production RPO and RTO must be positive');
  }

  validateTriage(config, now.getTime());
  validateMentaAgent(config);
}
