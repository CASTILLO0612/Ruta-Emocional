import { createHash } from 'crypto';
import {
  TriageAssessmentRecord,
  TriageDefinition,
  TriageModality,
  TriageProviderOutcomeValue,
  TriageRiskLevelValue,
  TriageRuleResult,
} from '../domain/triageTypes';

export interface TriageAuditContext {
  readonly actorUserId: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface TriageIdempotency {
  readonly key: string;
  readonly requestHash: string;
  readonly now: Date;
  readonly expiresAt: Date;
}

export interface CreateTriageAssessmentCommand {
  readonly countryCode: string;
  readonly serviceRequestId?: string;
  readonly answers: readonly {
    readonly questionCode: string;
    readonly optionCode: string;
  }[];
  readonly consent: {
    readonly documentCode: string;
    readonly documentVersion: string;
    readonly granted: true;
  };
}

export interface PersistTriageAssessmentInput {
  readonly serviceRequestId?: string;
  readonly consentDocumentId: string;
  readonly primaryNeedCode: string;
  readonly riskLevel: TriageRiskLevelValue;
  readonly recommendedModalities: readonly TriageModality[];
  readonly orientationSummary: string;
  readonly provider: string;
  readonly model: string;
  readonly evaluatorVersion: string;
  readonly providerOutcome: TriageProviderOutcomeValue;
  readonly countryCode: string;
  readonly ruleResults: readonly TriageRuleResult[];
}

export interface TriageRepository {
  getDefinition(
    consentDocumentCode: string,
    consentDocumentVersion: string,
    now: Date
  ): Promise<TriageDefinition>;
  createAssessment(
    patientUserId: string,
    input: PersistTriageAssessmentInput,
    idempotency: TriageIdempotency,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord>;
  getAssessment(
    actorUserId: string,
    assessmentId: string,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord>;
  reviewAssessment(
    psychologistUserId: string,
    assessmentId: string,
    reviewedAt: Date,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord>;
  withdrawConsent(
    patientUserId: string,
    assessmentId: string,
    withdrawnAt: Date,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord>;
  requestErasure(
    patientUserId: string,
    assessmentId: string,
    policyVersion: string,
    requestedAt: Date,
    dueAt: Date,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord>;
}

export interface TriageOrientationProvider {
  readonly providerName: string;
  readonly modelName: string;
  evaluate(input: {
    readonly primaryNeedCode: string;
    readonly riskLevel: 'LOW' | 'MODERATE';
    readonly recommendedModalities: readonly TriageModality[];
  }): Promise<unknown>;
}

export class TriageProviderUnavailableError extends Error {
  constructor() {
    super('External triage orientation provider is unavailable');
    this.name = 'TriageProviderUnavailableError';
  }
}

export function hashTriagePayload(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input), 'utf8').digest('hex');
}
