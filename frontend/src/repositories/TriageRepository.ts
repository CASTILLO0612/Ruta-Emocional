import { getTriageCountryCode } from '../config/runtimeConfig';
import { apiV1Request } from '../services/apiClient';

export type TriageRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type TriageModality = 'CHAT' | 'CALL' | 'IN_PERSON';
export type TriageProviderOutcome = 'NOT_USED' | 'SUCCEEDED' | 'UNAVAILABLE' | 'REJECTED_OUTPUT';

export interface TriageQuestionOption {
  readonly code: string;
  readonly label: string;
  readonly helpText: string | null;
  readonly displayOrder: number;
}

export interface TriageQuestion {
  readonly code: string;
  readonly prompt: string;
  readonly helpText: string | null;
  readonly displayOrder: number;
  readonly required: boolean;
  readonly options: readonly TriageQuestionOption[];
}

export interface TriagePolicy {
  readonly enabled: boolean;
  readonly protocolApproved: boolean;
  readonly externalProviderEnabled: boolean;
  readonly evaluatorVersion: string;
  readonly automatedSystemNotice: string;
  readonly emergencyDisclaimer: string;
  readonly defaultCountryCode: string;
  readonly supportedCountryCodes: readonly string[];
  readonly consentDocument: {
    readonly code: string;
    readonly version: string;
    readonly title: string;
    readonly content: string;
    readonly contentHash: string;
  };
  readonly questions: readonly TriageQuestion[];
}

export interface TriageCrisisResource {
  readonly code: string;
  readonly label: string;
  readonly channel: 'PHONE' | 'URL';
  readonly value: string;
  readonly sourceUrl: string;
  readonly verifiedAt: string;
}

export interface TriageAssessment {
  readonly id: string;
  readonly patientUserId: string;
  readonly primaryNeed: { readonly code: string; readonly name: string };
  readonly provider: string;
  readonly model: string;
  readonly evaluatorVersion: string;
  readonly providerOutcome: TriageProviderOutcome;
  readonly countryCode: string;
  readonly orientationSummary: string;
  readonly riskLevel: TriageRiskLevel;
  readonly recommendedModalities: readonly TriageModality[];
  readonly reviewedAt: string | null;
  readonly reviewedBy: { readonly userId: string; readonly displayName: string } | null;
  readonly createdAt: string;
  readonly automatedSystem: true;
  readonly diagnostic: false;
  readonly requiresImmediateHelp: boolean;
  readonly safetyActions: readonly string[];
  readonly crisisResources: readonly TriageCrisisResource[];
}

interface Envelope<T> { readonly data: T }

export async function fetchTriagePolicy(signal?: AbortSignal): Promise<TriagePolicy> {
  return (await apiV1Request<Envelope<TriagePolicy>>(
    '/triage/policy',
    'GET',
    undefined,
    { signal }
  )).data;
}

export async function createTriageAssessment(
  input: {
    readonly policy: TriagePolicy;
    readonly answers: Readonly<Record<string, string>>;
    readonly serviceRequestId?: string;
  },
  idempotencyKey: string
): Promise<TriageAssessment> {
  const countryCode = getTriageCountryCode();
  if (!input.policy.supportedCountryCodes.includes(countryCode)) {
    throw new Error('La orientación no tiene recursos de seguridad aprobados para el país configurado.');
  }
  return (await apiV1Request<Envelope<TriageAssessment>>(
    '/triage/assessments',
    'POST',
    {
      countryCode,
      ...(input.serviceRequestId ? { serviceRequestId: input.serviceRequestId } : {}),
      answers: input.policy.questions.map((question) => ({
        questionCode: question.code,
        optionCode: input.answers[question.code],
      })),
      consent: {
        documentCode: input.policy.consentDocument.code,
        documentVersion: input.policy.consentDocument.version,
        granted: true,
      },
    },
    { idempotencyKey }
  )).data;
}

export async function fetchTriageAssessment(
  assessmentId: string,
  signal?: AbortSignal
): Promise<TriageAssessment> {
  return (await apiV1Request<Envelope<TriageAssessment>>(
    `/triage/assessments/${encodeURIComponent(assessmentId)}`,
    'GET',
    undefined,
    { signal }
  )).data;
}

export async function reviewTriageAssessment(
  assessmentId: string
): Promise<TriageAssessment> {
  return (await apiV1Request<Envelope<TriageAssessment>>(
    `/triage/assessments/${encodeURIComponent(assessmentId)}/review`,
    'POST',
    {}
  )).data;
}
