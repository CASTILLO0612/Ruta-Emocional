export const CLINICAL_NOTE_STATUSES = ['DRAFT', 'SIGNED', 'AMENDED'] as const;
export type ClinicalNoteStatusValue = typeof CLINICAL_NOTE_STATUSES[number];

export const TREATMENT_PLAN_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const;
export type TreatmentPlanStatusValue = typeof TREATMENT_PLAN_STATUSES[number];

export const TREATMENT_PLAN_TRANSITIONS = ['ACTIVATE', 'COMPLETE', 'CANCEL'] as const;
export type TreatmentPlanTransition = typeof TREATMENT_PLAN_TRANSITIONS[number];

export const TREATMENT_GOAL_STATUSES = ['PENDING', 'IN_PROGRESS', 'ACHIEVED', 'CANCELLED'] as const;
export type TreatmentGoalStatusValue = typeof TREATMENT_GOAL_STATUSES[number];

export interface ClinicalPatientSummary {
  readonly patientUserId: string;
  readonly careRelationshipId: string;
  readonly triageAssessmentId: string | null;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly recordId: string | null;
  readonly recordStatus: 'OPEN' | 'CLOSED' | 'ARCHIVED' | null;
  readonly lastEncounterAt: string | null;
  readonly draftNotesCount: number;
}

export interface ClinicalNoteSummary {
  readonly id: string;
  readonly status: ClinicalNoteStatusValue;
  readonly latestVersionNumber: number;
  readonly content: string;
  readonly signedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClinicalEncounterView {
  readonly id: string;
  readonly careRelationshipId: string;
  readonly appointmentId: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly reason: string | null;
  readonly createdAt: string;
  readonly note: ClinicalNoteSummary;
}

export interface TreatmentGoalView {
  readonly id: string;
  readonly description: string;
  readonly targetDate: string | null;
  readonly status: TreatmentGoalStatusValue;
}

export interface TreatmentPlanView {
  readonly id: string;
  readonly status: TreatmentPlanStatusValue;
  readonly summary: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly goals: readonly TreatmentGoalView[];
}

export interface ClinicalRecordView {
  readonly id: string | null;
  readonly status: 'OPEN' | 'CLOSED' | 'ARCHIVED' | null;
  readonly openedAt: string | null;
  readonly patient: {
    readonly userId: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
  };
  readonly careRelationshipId: string;
  readonly encounters: readonly ClinicalEncounterView[];
  readonly treatmentPlans: readonly TreatmentPlanView[];
  readonly nextCursor: string | null;
}

export interface ClinicalNoteVersionView {
  readonly id: string;
  readonly versionNumber: number;
  readonly content: string;
  readonly amendmentReason: string | null;
  readonly createdAt: string;
  readonly author: {
    readonly userId: string;
    readonly displayName: string;
  };
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface PatientCursor {
  readonly normalizedName: string;
  readonly id: string;
}

export interface EncounterCursor {
  readonly startedAt: Date;
  readonly id: string;
}

export interface ClinicalPageQuery<TCursor> {
  readonly limit: number;
  readonly cursor?: TCursor;
}

export function encodePatientCursor(cursor: PatientCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function encodeEncounterCursor(cursor: EncounterCursor): string {
  return Buffer.from(JSON.stringify({
    startedAt: cursor.startedAt.toISOString(),
    id: cursor.id,
  }), 'utf8').toString('base64url');
}
