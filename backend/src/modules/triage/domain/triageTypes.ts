export const TRIAGE_RISK_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const;
export type TriageRiskLevelValue = typeof TRIAGE_RISK_LEVELS[number];

export const TRIAGE_MODALITIES = ['CHAT', 'CALL', 'IN_PERSON'] as const;
export type TriageModality = typeof TRIAGE_MODALITIES[number];

export type TriageProviderOutcomeValue =
  | 'NOT_USED'
  | 'SUCCEEDED'
  | 'UNAVAILABLE'
  | 'REJECTED_OUTPUT';

export type TriageErasureRequestStatusValue =
  | 'BLOCKED'
  | 'UNDER_REVIEW'
  | 'RESOLVED'
  | 'DENIED';

export interface TriageAnswer {
  readonly questionCode: string;
  readonly optionCode: string;
}

export interface TriageNeedDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly fallbackSummary: string;
  readonly modalities: readonly {
    readonly modality: TriageModality;
    readonly priority: number;
  }[];
}

export interface TriageOptionDefinition {
  readonly code: string;
  readonly questionCode: string;
  readonly label: string;
  readonly helpText: string | null;
  readonly needCode: string | null;
  readonly modality: TriageModality | null;
  readonly displayOrder: number;
}

export interface TriageQuestionDefinition {
  readonly code: string;
  readonly prompt: string;
  readonly helpText: string | null;
  readonly displayOrder: number;
  readonly isRequired: boolean;
  readonly options: readonly TriageOptionDefinition[];
}

export interface TriageRuleDefinition {
  readonly id: string;
  readonly code: string;
  readonly version: string;
  readonly name: string;
  readonly triggerOptionCode: string;
  readonly riskLevel: TriageRiskLevelValue;
}

export interface TriageConsentDocumentDefinition {
  readonly id: string;
  readonly code: string;
  readonly version: string;
  readonly title: string;
  readonly content: string;
  readonly contentHash: string;
}

export interface TriageDefinition {
  readonly consentDocument: TriageConsentDocumentDefinition;
  readonly questions: readonly TriageQuestionDefinition[];
  readonly needs: readonly TriageNeedDefinition[];
  readonly rules: readonly TriageRuleDefinition[];
}

export interface TriageRuleResult {
  readonly ruleId: string;
  readonly ruleCode: string;
  readonly ruleVersion: string;
  readonly matched: boolean;
  readonly evidenceOptionCode: string | null;
}

export interface DeterministicTriageResult {
  readonly primaryNeed: TriageNeedDefinition;
  readonly riskLevel: TriageRiskLevelValue;
  readonly recommendedModalities: readonly TriageModality[];
  readonly fallbackSummary: string;
  readonly selectedOptionCodes: readonly string[];
  readonly ruleResults: readonly TriageRuleResult[];
}

export interface TriageAssessmentRecord {
  readonly id: string;
  readonly patientUserId: string;
  readonly primaryNeed: {
    readonly code: string;
    readonly name: string;
  };
  readonly provider: string;
  readonly model: string;
  readonly evaluatorVersion: string;
  readonly providerOutcome: TriageProviderOutcomeValue;
  readonly countryCode: string;
  readonly orientationSummary: string;
  readonly riskLevel: TriageRiskLevelValue;
  readonly recommendedModalities: readonly TriageModality[];
  readonly reviewedAt: string | null;
  readonly reviewedBy: {
    readonly userId: string;
    readonly displayName: string;
  } | null;
  readonly consentWithdrawnAt: string | null;
  readonly erasureRequest: {
    readonly id: string;
    readonly status: TriageErasureRequestStatusValue;
    readonly policyVersion: string;
    readonly requestedAt: string;
    readonly dueAt: string;
    readonly resolvedAt: string | null;
  } | null;
  readonly createdAt: string;
}

export interface TriageCrisisResourceView {
  readonly code: string;
  readonly label: string;
  readonly channel: 'PHONE' | 'URL';
  readonly value: string;
  readonly sourceUrl: string;
  readonly verifiedAt: string;
}

export interface TriageAssessmentView extends TriageAssessmentRecord {
  readonly automatedSystem: true;
  readonly diagnostic: false;
  readonly requiresImmediateHelp: boolean;
  readonly safetyActions: readonly string[];
  readonly crisisResources: readonly TriageCrisisResourceView[];
}

export interface TriagePolicyView {
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
  readonly questions: readonly {
    readonly code: string;
    readonly prompt: string;
    readonly helpText: string | null;
    readonly displayOrder: number;
    readonly required: boolean;
    readonly options: readonly {
      readonly code: string;
      readonly label: string;
      readonly helpText: string | null;
      readonly displayOrder: number;
    }[];
  }[];
}
