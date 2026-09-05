import assert from 'node:assert/strict';
import test from 'node:test';
import { AppConfig } from '../../src/config/env';
import {
  assertProductionReadiness,
  ProductionReadinessError,
} from '../../src/config/productionReadiness';
import { createTestConfig } from '../support/testConfig';

const NOW = new Date('2026-08-30T12:00:00.000Z');

function readyConfig(): AppConfig {
  const base = createTestConfig(
    'postgresql://ruta_emocional_app_a:runtime-password@example.test/ruta_emocional',
    'production-readiness'
  );
  return {
    ...base,
    environment: 'production',
    secrets: {
      source: 'EXTERNAL_INJECTION',
      bundleVersion: 'aws-sm-2026-08-30.1',
    },
    operations: {
      runtimeDatabaseRole: 'ruta_emocional_runtime',
      backupProvider: 'AWS_RDS_AUTOMATED_BACKUP',
      lastRestoreVerifiedAt: '2026-08-20T12:00:00.000Z',
      maximumRestoreAgeDays: 30,
      rpoMinutes: 60,
      rtoMinutes: 240,
      observabilityProvider: 'AWS_CLOUDWATCH',
      alertingEnabled: true,
    },
    passwordRecovery: {
      ...base.passwordRecovery,
      provider: 'RESEND',
      resendApiKey: 're_test_password_recovery_provider_key',
      sender: 'acceso@rutaemocional.example',
      resetUrl: 'https://app.rutaemocional.example/restablecer-contrasena',
    },
    triage: {
      ...base.triage,
      protocolApproved: true,
      protocolApproval: {
        approvalId: 'MENTA-2026-001',
        evaluatorVersion: base.triage.evaluatorVersion,
        consentDocumentCode: base.triage.consentDocumentCode,
        consentDocumentVersion: base.triage.consentDocumentVersion,
        reviewerRegistration: 'MINSA-TEST-001',
        artifactSha256: 'a'.repeat(64),
        approvedAt: '2026-08-29T12:00:00.000Z',
        expiresAt: '2027-08-29T12:00:00.000Z',
      },
      retentionPolicy: {
        approved: true,
        version: 'NI-PRIVACY-2026.1',
        assessmentRetentionDays: 1_825,
        erasureRequestSlaBusinessDays: 5,
      },
    },
  };
}

test('production readiness accepts a complete, current and least-privilege configuration', () => {
  assert.doesNotThrow(() => assertProductionReadiness(readyConfig(), NOW));
});

test('production readiness rejects privileged database identities and local secrets', () => {
  assert.throws(
    () => assertProductionReadiness({
      ...readyConfig(),
      databaseUrl: 'postgresql://postgres:password@example.test/ruta_emocional',
    }, NOW),
    ProductionReadinessError
  );
  assert.throws(
    () => assertProductionReadiness({
      ...readyConfig(),
      secrets: { source: 'LOCAL_ENV', bundleVersion: null },
    }, NOW),
    ProductionReadinessError
  );
});

test('production readiness rejects missing clinical evidence and stale operational evidence', () => {
  const ready = readyConfig();
  assert.throws(
    () => assertProductionReadiness({
      ...ready,
      triage: { ...ready.triage, protocolApproval: null },
    }, NOW),
    ProductionReadinessError
  );
  assert.throws(
    () => assertProductionReadiness({
      ...ready,
      operations: {
        ...ready.operations,
        lastRestoreVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
    }, NOW),
    ProductionReadinessError
  );
});

test('production readiness rejects a password recovery flow without delivery', () => {
  const ready = readyConfig();
  assert.throws(
    () => assertProductionReadiness({
      ...ready,
      passwordRecovery: {
        ...ready.passwordRecovery,
        provider: 'DISABLED',
        resendApiKey: null,
        sender: null,
        resetUrl: null,
      },
    }, NOW),
    ProductionReadinessError
  );
});

test('production readiness rejects expired resources, unapproved retention and external MENTA', () => {
  const ready = readyConfig();
  const resources = ready.triage.crisisResources.NI.map((resource) => ({
    ...resource,
    reviewDueAt: '2026-08-29',
  }));
  assert.throws(
    () => assertProductionReadiness({
      ...ready,
      triage: {
        ...ready.triage,
        crisisResources: { NI: resources },
      },
    }, NOW),
    ProductionReadinessError
  );
  assert.throws(
    () => assertProductionReadiness({
      ...ready,
      triage: {
        ...ready.triage,
        retentionPolicy: { ...ready.triage.retentionPolicy, approved: false },
      },
    }, NOW),
    ProductionReadinessError
  );
  assert.throws(
    () => assertProductionReadiness({
      ...ready,
      triage: { ...ready.triage, externalProviderEnabled: true },
    }, NOW),
    ProductionReadinessError
  );
});

test('production readiness fails closed when the contextual MENTA provider lacks governance', () => {
  const ready = readyConfig();
  assert.throws(
    () => assertProductionReadiness({
      ...ready,
      menta: { ...ready.menta, enabled: true, provider: 'DISABLED' },
    }, NOW),
    ProductionReadinessError
  );
  assert.throws(
    () => assertProductionReadiness({
      ...ready,
      menta: {
        ...ready.menta,
        enabled: true,
        provider: 'GEMINI',
        externalProviderApproved: false,
      },
    }, NOW),
    ProductionReadinessError
  );
  assert.throws(
    () => assertProductionReadiness({
      ...ready,
      menta: {
        ...ready.menta,
        enabled: true,
        provider: 'GEMINI',
        externalProviderApproved: true,
        retentionPolicyApproved: false,
      },
    }, NOW),
    ProductionReadinessError
  );
});
