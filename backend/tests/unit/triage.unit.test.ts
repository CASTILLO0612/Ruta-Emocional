import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import {
  addBusinessDays,
  TriageService,
} from '../../src/modules/triage/application/triageService';
import {
  PersistTriageAssessmentInput,
  TriageAuditContext,
  TriageIdempotency,
  TriageOrientationProvider,
  TriageRepository,
} from '../../src/modules/triage/application/ports';
import { DeterministicTriageEngine } from '../../src/modules/triage/domain/deterministicTriageEngine';
import {
  TriageProviderOutputError,
  validateProviderOrientation,
} from '../../src/modules/triage/domain/providerOutputValidator';
import {
  TriageAssessmentRecord,
  TriageDefinition,
} from '../../src/modules/triage/domain/triageTypes';
import {
  parseCreateTriageAssessment,
  parseTriageIdempotencyKey,
} from '../../src/modules/triage/presentation/triageValidation';
import { AuthenticatedActor } from '../../src/modules/identity/application/identityService';
import { AppError } from '../../src/shared/domain/appError';
import { Clock } from '../../src/shared/application/clock';
import { createTestConfig } from '../support/testConfig';
import {
  buildTriageProtocolArtifact,
  hashTriageProtocolArtifact,
} from '../../src/modules/triage/domain/triageProtocolArtifact';

const definition: TriageDefinition = {
  consentDocument: {
    id: randomUUID(),
    code: 'MENTA_ORIENTATION',
    version: '1.0.0',
    title: 'Consentimiento MENTA',
    content: 'Contenido vigente de prueba.',
    contentHash: 'a'.repeat(64),
  },
  needs: [{
    code: 'ANXIETY_STRESS',
    name: 'Ansiedad o estrés',
    description: 'Descripción',
    fallbackSummary: 'Orientación determinista segura.',
    modalities: [
      { modality: 'CALL', priority: 1 },
      { modality: 'CHAT', priority: 2 },
    ],
  }],
  questions: [
    {
      code: 'PRIMARY_NEED',
      prompt: 'Necesidad',
      helpText: null,
      displayOrder: 1,
      isRequired: true,
      options: [{
        code: 'NEED_ANXIETY_STRESS',
        questionCode: 'PRIMARY_NEED',
        label: 'Ansiedad',
        helpText: null,
        needCode: 'ANXIETY_STRESS',
        modality: null,
        displayOrder: 1,
      }],
    },
    {
      code: 'SUPPORT_PREFERENCE',
      prompt: 'Preferencia',
      helpText: null,
      displayOrder: 2,
      isRequired: true,
      options: [{
        code: 'PREFERENCE_CHAT',
        questionCode: 'SUPPORT_PREFERENCE',
        label: 'Chat',
        helpText: null,
        needCode: null,
        modality: 'CHAT',
        displayOrder: 1,
      }],
    },
    {
      code: 'CURRENT_SAFETY',
      prompt: 'Seguridad',
      helpText: null,
      displayOrder: 3,
      isRequired: true,
      options: [
        {
          code: 'SAFETY_SAFE_NOW',
          questionCode: 'CURRENT_SAFETY',
          label: 'A salvo',
          helpText: null,
          needCode: null,
          modality: null,
          displayOrder: 1,
        },
        {
          code: 'SAFETY_UNSAFE_NOW',
          questionCode: 'CURRENT_SAFETY',
          label: 'Peligro',
          helpText: null,
          needCode: null,
          modality: null,
          displayOrder: 2,
        },
      ],
    },
  ],
  rules: [{
    id: randomUUID(),
    code: 'IMMEDIATE_DANGER',
    version: '1.0.0',
    name: 'Peligro inmediato',
    triggerOptionCode: 'SAFETY_UNSAFE_NOW',
    riskLevel: 'CRITICAL',
  }],
};

const patientActor: AuthenticatedActor = {
  sessionId: randomUUID(),
  user: {
    id: randomUUID(),
    email: 'patient@example.test',
    displayName: 'Paciente de prueba',
    photoUrl: null,
    status: 'ACTIVE',
    roles: ['patient'],
    psychologistVerificationStatus: null,
    capabilities: ['triage:create:self', 'triage:read:self'],
  },
};

class FixedClock implements Clock {
  now() { return new Date('2026-08-30T12:00:00.000Z'); }
}

class MemoryTriageRepository implements TriageRepository {
  lastInput: PersistTriageAssessmentInput | null = null;

  async getDefinition() { return definition; }

  async createAssessment(
    patientUserId: string,
    input: PersistTriageAssessmentInput,
    _idempotency: TriageIdempotency,
    _audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord> {
    this.lastInput = input;
    return {
      id: randomUUID(),
      patientUserId,
      primaryNeed: { code: input.primaryNeedCode, name: 'Ansiedad o estrés' },
      provider: input.provider,
      model: input.model,
      evaluatorVersion: input.evaluatorVersion,
      providerOutcome: input.providerOutcome,
      countryCode: input.countryCode,
      orientationSummary: input.orientationSummary,
      riskLevel: input.riskLevel,
      recommendedModalities: input.recommendedModalities,
      reviewedAt: null,
      reviewedBy: null,
      consentWithdrawnAt: null,
      erasureRequest: null,
      createdAt: '2026-08-30T12:00:00.000Z',
    };
  }

  async getAssessment(): Promise<TriageAssessmentRecord> { throw new Error('not used'); }
  async reviewAssessment(): Promise<TriageAssessmentRecord> { throw new Error('not used'); }
  async withdrawConsent(): Promise<TriageAssessmentRecord> { throw new Error('not used'); }
  async requestErasure(): Promise<TriageAssessmentRecord> { throw new Error('not used'); }
}

class RecordingProvider implements TriageOrientationProvider {
  readonly providerName = 'TEST';
  readonly modelName = 'TEST_MODEL';
  calls: unknown[] = [];

  constructor(private readonly response: unknown, private readonly shouldFail = false) {}

  async evaluate(input: unknown): Promise<unknown> {
    this.calls.push(input);
    if (this.shouldFail) throw new Error('provider offline');
    return this.response;
  }
}

function command(safetyOption: 'SAFETY_SAFE_NOW' | 'SAFETY_UNSAFE_NOW') {
  return {
    countryCode: 'NI',
    answers: [
      { questionCode: 'PRIMARY_NEED', optionCode: 'NEED_ANXIETY_STRESS' },
      { questionCode: 'SUPPORT_PREFERENCE', optionCode: 'PREFERENCE_CHAT' },
      { questionCode: 'CURRENT_SAFETY', optionCode: safetyOption },
    ],
    consent: { documentCode: 'MENTA_ORIENTATION', documentVersion: '1.0.0', granted: true as const },
  };
}

test('triage input is closed and never accepts free text, actor or budget fields', () => {
  const parsed = parseCreateTriageAssessment(command('SAFETY_SAFE_NOW'));
  assert.equal(parsed.answers.length, 3);
  assert.throws(() => parseCreateTriageAssessment({
    ...command('SAFETY_SAFE_NOW'),
    patientUserId: randomUUID(),
    freeText: 'private clinical text',
    budget: 500,
  }), (error: unknown) => error instanceof AppError
    && error.errors?.filter(({ code }) => code === 'UNKNOWN_FIELD').length === 3);
  assert.throws(() => parseTriageIdempotencyKey('retry-1'), AppError);
});

test('privacy request deadline counts business days in UTC', () => {
  assert.equal(
    addBusinessDays(new Date('2026-08-28T12:00:00.000Z'), 5).toISOString(),
    '2026-09-04T12:00:00.000Z'
  );
});

test('clinical approval artifact hash changes when an active message changes', () => {
  const policy = createTestConfig('postgresql://integration.invalid/db', 'triage-unit').triage;
  const artifact = buildTriageProtocolArtifact(definition, policy);
  const altered = {
    ...artifact,
    emergencyDisclaimer: `${artifact.emergencyDisclaimer} Texto alterado.`,
  };
  assert.notEqual(hashTriageProtocolArtifact(artifact), hashTriageProtocolArtifact(altered));
});

test('deterministic engine suppresses modalities in critical risk', () => {
  const engine = new DeterministicTriageEngine();
  const low = engine.evaluate(definition, command('SAFETY_SAFE_NOW').answers);
  assert.equal(low.riskLevel, 'LOW');
  assert.deepEqual(low.recommendedModalities, ['CHAT', 'CALL']);
  const critical = engine.evaluate(definition, command('SAFETY_UNSAFE_NOW').answers);
  assert.equal(critical.riskLevel, 'CRITICAL');
  assert.deepEqual(critical.recommendedModalities, []);
  assert.equal(critical.ruleResults[0].matched, true);
});

test('provider output validator rejects diagnoses, commercial fields and modality escalation', () => {
  assert.deepEqual(validateProviderOrientation({
    summary: 'Puedes conversar con un profesional para explorar lo que estás viviendo.',
    recommendedModalities: ['CHAT'],
  }, ['CHAT', 'CALL'], 500).recommendedModalities, ['CHAT']);
  assert.throws(() => validateProviderOrientation({
    summary: 'Tu diagnóstico es ansiedad.',
    recommendedModalities: ['CHAT'],
  }, ['CHAT'], 500), TriageProviderOutputError);
  assert.throws(() => validateProviderOrientation({
    summary: 'Orientación.',
    recommendedModalities: ['CHAT'],
    suggestedBudget: 500,
  }, ['CHAT'], 500), TriageProviderOutputError);
  assert.throws(() => validateProviderOrientation({
    summary: 'Orientación.',
    recommendedModalities: ['IN_PERSON'],
  }, ['CHAT'], 500), TriageProviderOutputError);
});

test('provider outage keeps deterministic fallback and sends only minimized categories', async () => {
  const repository = new MemoryTriageRepository();
  const provider = new RecordingProvider(undefined, true);
  const basePolicy = createTestConfig('postgresql://integration.invalid/db', 'triage-unit').triage;
  const service = new TriageService(
    repository,
    new DeterministicTriageEngine(),
    provider,
    new FixedClock(),
    { ...basePolicy, externalProviderEnabled: true }
  );
  const result = await service.createAssessment(
    patientActor,
    command('SAFETY_SAFE_NOW'),
    randomUUID(),
    { actorUserId: patientActor.user.id }
  );
  assert.equal(result.providerOutcome, 'UNAVAILABLE');
  assert.equal(result.orientationSummary, 'Orientación determinista segura.');
  assert.equal(provider.calls.length, 1);
  assert.deepEqual(Object.keys(provider.calls[0] as object).sort(), [
    'primaryNeedCode', 'recommendedModalities', 'riskLevel',
  ]);
  assert.equal(JSON.stringify(provider.calls[0]).includes(patientActor.user.email), false);
  assert.equal(JSON.stringify(provider.calls[0]).includes(patientActor.user.displayName), false);
});

test('approved provider output records its real provider and model identifiers', async () => {
  const repository = new MemoryTriageRepository();
  const provider = new RecordingProvider({
    summary: 'Puedes conversar con un profesional para explorar lo que estás viviendo.',
    recommendedModalities: ['CHAT'],
  });
  const basePolicy = createTestConfig('postgresql://integration.invalid/db', 'triage-provider').triage;
  const service = new TriageService(
    repository,
    new DeterministicTriageEngine(),
    provider,
    new FixedClock(),
    { ...basePolicy, externalProviderEnabled: true }
  );

  const result = await service.createAssessment(
    patientActor,
    command('SAFETY_SAFE_NOW'),
    randomUUID(),
    { actorUserId: patientActor.user.id }
  );

  assert.equal(result.providerOutcome, 'SUCCEEDED');
  assert.equal(result.provider, provider.providerName);
  assert.equal(result.model, provider.modelName);
  assert.deepEqual(result.recommendedModalities, ['CHAT']);
});

test('critical risk never invokes the external provider and exposes configured safety resources', async () => {
  const repository = new MemoryTriageRepository();
  const provider = new RecordingProvider({
    summary: 'Should not be used.',
    recommendedModalities: ['CHAT'],
  });
  const basePolicy = createTestConfig('postgresql://integration.invalid/db', 'triage-critical').triage;
  const service = new TriageService(
    repository,
    new DeterministicTriageEngine(),
    provider,
    new FixedClock(),
    { ...basePolicy, externalProviderEnabled: true }
  );
  const result = await service.createAssessment(
    patientActor,
    command('SAFETY_UNSAFE_NOW'),
    randomUUID(),
    { actorUserId: patientActor.user.id }
  );
  assert.equal(provider.calls.length, 0);
  assert.equal(result.requiresImmediateHelp, true);
  assert.deepEqual(result.recommendedModalities, []);
  assert.equal(result.crisisResources[0].code, 'TEST_EMERGENCY');
  assert.ok(result.safetyActions.length > 0);
});
