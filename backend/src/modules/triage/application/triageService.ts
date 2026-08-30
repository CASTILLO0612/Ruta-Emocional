import { AppConfig } from '../../../config/env';
import { Clock } from '../../../shared/application/clock';
import { AppError } from '../../../shared/domain/appError';
import { AuthenticatedActor } from '../../identity/application/identityService';
import { DeterministicTriageEngine } from '../domain/deterministicTriageEngine';
import {
  TriageProviderOutputError,
  validateProviderOrientation,
} from '../domain/providerOutputValidator';
import {
  TriageAssessmentRecord,
  TriageAssessmentView,
  TriagePolicyView,
  TriageProviderOutcomeValue,
} from '../domain/triageTypes';
import {
  CreateTriageAssessmentCommand,
  hashTriagePayload,
  TriageAuditContext,
  TriageIdempotency,
  TriageOrientationProvider,
  TriageRepository,
} from './ports';

const INTERNAL_PROVIDER = 'RUTA_EMOCIONAL';
const DETERMINISTIC_MODEL = 'DETERMINISTIC_TRIAGE';
const AUTOMATED_NOTICE = 'MENTA es un sistema automatizado de orientación y siempre se identifica como tal.';
const EMERGENCY_DISCLAIMER = 'MENTA no es un servicio de emergencia, no realiza diagnósticos y no contacta servicios de emergencia por ti.';

export class TriageService {
  constructor(
    private readonly repository: TriageRepository,
    private readonly engine: DeterministicTriageEngine,
    private readonly provider: TriageOrientationProvider,
    private readonly clock: Clock,
    private readonly policy: AppConfig['triage']
  ) {}

  async getPolicy(actor: AuthenticatedActor): Promise<TriagePolicyView> {
    this.assertCapability(actor, 'triage:create:self');
    this.assertAvailable();
    const definition = await this.definition();
    return {
      enabled: true,
      protocolApproved: this.policy.protocolApproved,
      externalProviderEnabled: this.policy.externalProviderEnabled,
      evaluatorVersion: this.policy.evaluatorVersion,
      automatedSystemNotice: AUTOMATED_NOTICE,
      emergencyDisclaimer: EMERGENCY_DISCLAIMER,
      defaultCountryCode: this.policy.defaultCountryCode,
      supportedCountryCodes: Object.keys(this.policy.crisisResources).sort(),
      consentDocument: {
        code: definition.consentDocument.code,
        version: definition.consentDocument.version,
        title: definition.consentDocument.title,
        content: definition.consentDocument.content,
        contentHash: definition.consentDocument.contentHash,
      },
      questions: definition.questions.map((question) => ({
        code: question.code,
        prompt: question.prompt,
        helpText: question.helpText,
        displayOrder: question.displayOrder,
        required: question.isRequired,
        options: question.options.map((option) => ({
          code: option.code,
          label: option.label,
          helpText: option.helpText,
          displayOrder: option.displayOrder,
        })),
      })),
    };
  }

  async createAssessment(
    actor: AuthenticatedActor,
    command: CreateTriageAssessmentCommand,
    idempotencyKey: string,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentView> {
    this.assertCapability(actor, 'triage:create:self');
    this.assertAvailable();
    this.assertCountry(command.countryCode);
    const definition = await this.definition();
    if (
      !command.consent.granted
      || command.consent.documentCode !== definition.consentDocument.code
      || command.consent.documentVersion !== definition.consentDocument.version
    ) {
      throw AppError.validation([{
        field: 'consent',
        code: 'CURRENT_CONSENT_REQUIRED',
        message: 'Debes aceptar la versión vigente del consentimiento antes de continuar.',
      }]);
    }

    const deterministic = this.engine.evaluate(definition, command.answers);
    let orientationSummary = deterministic.fallbackSummary;
    let recommendedModalities = deterministic.recommendedModalities;
    let providerOutcome: TriageProviderOutcomeValue = 'NOT_USED';

    if (
      this.policy.externalProviderEnabled
      && (deterministic.riskLevel === 'LOW' || deterministic.riskLevel === 'MODERATE')
    ) {
      try {
        const external = validateProviderOrientation(
          await this.provider.evaluate({
            primaryNeedCode: deterministic.primaryNeed.code,
            riskLevel: deterministic.riskLevel,
            recommendedModalities,
          }),
          deterministic.recommendedModalities,
          this.policy.maximumProviderSummaryLength
        );
        orientationSummary = external.summary;
        recommendedModalities = external.recommendedModalities;
        providerOutcome = 'SUCCEEDED';
      } catch (error) {
        providerOutcome = error instanceof TriageProviderOutputError
          ? 'REJECTED_OUTPUT'
          : 'UNAVAILABLE';
      }
    }

    const persisted = await this.repository.createAssessment(
      actor.user.id,
      {
        ...(command.serviceRequestId ? { serviceRequestId: command.serviceRequestId } : {}),
        consentDocumentId: definition.consentDocument.id,
        primaryNeedCode: deterministic.primaryNeed.code,
        riskLevel: deterministic.riskLevel,
        recommendedModalities,
        orientationSummary,
        provider: providerOutcome === 'SUCCEEDED' ? this.provider.providerName : INTERNAL_PROVIDER,
        model: providerOutcome === 'SUCCEEDED' ? this.provider.modelName : DETERMINISTIC_MODEL,
        evaluatorVersion: this.policy.evaluatorVersion,
        providerOutcome,
        countryCode: command.countryCode,
        ruleResults: deterministic.ruleResults,
      },
      this.idempotency(idempotencyKey, command),
      audit
    );
    return this.toView(persisted);
  }

  async getAssessment(
    actor: AuthenticatedActor,
    assessmentId: string,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentView> {
    this.assertReadable(actor);
    this.assertAvailable();
    return this.toView(await this.repository.getAssessment(actor.user.id, assessmentId, audit));
  }

  async reviewAssessment(
    actor: AuthenticatedActor,
    assessmentId: string,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentView> {
    this.assertCapability(actor, 'triage:review:authorized');
    this.assertAvailable();
    return this.toView(await this.repository.reviewAssessment(
      actor.user.id,
      assessmentId,
      this.clock.now(),
      audit
    ));
  }

  private async definition() {
    return this.repository.getDefinition(
      this.policy.consentDocumentCode,
      this.policy.consentDocumentVersion,
      this.clock.now()
    );
  }

  private idempotency(
    key: string,
    command: CreateTriageAssessmentCommand
  ): TriageIdempotency {
    const now = this.clock.now();
    return {
      key,
      requestHash: hashTriagePayload({ operation: 'triage.assessment.create', command }),
      now,
      expiresAt: new Date(now.getTime() + this.policy.idempotencyTtlHours * 3_600_000),
    };
  }

  private toView(record: TriageAssessmentRecord): TriageAssessmentView {
    const requiresImmediateHelp = record.riskLevel === 'HIGH' || record.riskLevel === 'CRITICAL';
    const safetyActions = requiresImmediateHelp ? this.policy.safetyActions[record.riskLevel] : [];
    const crisisResources = requiresImmediateHelp
      ? this.policy.crisisResources[record.countryCode] ?? []
      : [];
    return {
      ...record,
      automatedSystem: true,
      diagnostic: false,
      requiresImmediateHelp,
      safetyActions,
      crisisResources,
    };
  }

  private assertAvailable(): void {
    if (!this.policy.enabled) {
      throw new AppError(
        503,
        'TRIAGE_UNAVAILABLE',
        'Orientación no disponible',
        'La orientación automatizada no está habilitada en este entorno.'
      );
    }
  }

  private assertCountry(countryCode: string): void {
    if (!this.policy.crisisResources[countryCode]) {
      throw AppError.validation([{
        field: 'countryCode',
        code: 'UNSUPPORTED_COUNTRY',
        message: 'No hay un protocolo de recursos configurado para el país indicado.',
      }]);
    }
  }

  private assertReadable(actor: AuthenticatedActor): void {
    if (
      !actor.user.capabilities.includes('triage:read:self')
      && !actor.user.capabilities.includes('triage:review:authorized')
    ) {
      throw AppError.forbidden('TRIAGE_CAPABILITY_REQUIRED');
    }
  }

  private assertCapability(actor: AuthenticatedActor, capability: string): void {
    if (!actor.user.capabilities.includes(capability)) {
      throw AppError.forbidden('TRIAGE_CAPABILITY_REQUIRED');
    }
  }
}
