import { apiV1Request } from '../services/apiClient';

export type ClinicalNoteStatus = 'DRAFT' | 'SIGNED' | 'AMENDED';
export type TreatmentPlanStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type TreatmentPlanTransition = 'ACTIVATE' | 'COMPLETE' | 'CANCEL';
export type TreatmentGoalStatus = 'PENDING' | 'IN_PROGRESS' | 'ACHIEVED' | 'CANCELLED';

export interface ClinicalPolicy {
  readonly maximumNoteLength: number;
  readonly maximumEncounterReasonLength: number;
  readonly maximumTreatmentSummaryLength: number;
  readonly maximumGoalLength: number;
  readonly maximumGoalsPerPlan: number;
  readonly minimumAmendmentReasonLength: number;
  readonly maximumAmendmentReasonLength: number;
}

export interface ClinicalPatient {
  readonly patientUserId: string;
  readonly careRelationshipId: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly recordId: string | null;
  readonly recordStatus: 'OPEN' | 'CLOSED' | 'ARCHIVED' | null;
  readonly lastEncounterAt: string | null;
  readonly draftNotesCount: number;
}

export interface ClinicalNote {
  readonly id: string;
  readonly status: ClinicalNoteStatus;
  readonly latestVersionNumber: number;
  readonly content: string;
  readonly signedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClinicalEncounter {
  readonly id: string;
  readonly careRelationshipId: string;
  readonly appointmentId: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly reason: string | null;
  readonly createdAt: string;
  readonly note: ClinicalNote;
}

export interface TreatmentGoal {
  readonly id: string;
  readonly description: string;
  readonly targetDate: string | null;
  readonly status: TreatmentGoalStatus;
}

export interface TreatmentPlan {
  readonly id: string;
  readonly status: TreatmentPlanStatus;
  readonly summary: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly goals: readonly TreatmentGoal[];
}

export interface ClinicalRecord {
  readonly id: string | null;
  readonly status: 'OPEN' | 'CLOSED' | 'ARCHIVED' | null;
  readonly openedAt: string | null;
  readonly patient: {
    readonly userId: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
  };
  readonly careRelationshipId: string;
  readonly encounters: readonly ClinicalEncounter[];
  readonly treatmentPlans: readonly TreatmentPlan[];
  readonly nextCursor: string | null;
}

export interface ClinicalNoteVersion {
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

interface Envelope<T> { readonly data: T }
interface PageEnvelope<T> {
  readonly data: readonly T[];
  readonly meta: { readonly nextCursor: string | null };
}

function queryString(parameters: Record<string, string | number | undefined>): string {
  const query = Object.entries(parameters)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  return query ? `?${query}` : '';
}

export async function fetchClinicalPolicy(signal?: AbortSignal): Promise<ClinicalPolicy> {
  return (await apiV1Request<Envelope<ClinicalPolicy>>(
    '/clinical/policy',
    'GET',
    undefined,
    { signal }
  )).data;
}

export function fetchClinicalPatients(
  cursor?: string,
  signal?: AbortSignal
): Promise<PageEnvelope<ClinicalPatient>> {
  return apiV1Request<PageEnvelope<ClinicalPatient>>(
    `/clinical/patients${queryString({ cursor })}`,
    'GET',
    undefined,
    { signal }
  );
}

export async function fetchClinicalRecord(
  patientUserId: string,
  cursor?: string,
  signal?: AbortSignal
): Promise<ClinicalRecord> {
  return (await apiV1Request<Envelope<ClinicalRecord>>(
    `/clinical/patients/${encodeURIComponent(patientUserId)}/record${queryString({ cursor })}`,
    'GET',
    undefined,
    { signal }
  )).data;
}

export async function fetchClinicalNoteVersions(
  noteId: string,
  signal?: AbortSignal
): Promise<readonly ClinicalNoteVersion[]> {
  return (await apiV1Request<Envelope<readonly ClinicalNoteVersion[]>>(
    `/clinical/notes/${encodeURIComponent(noteId)}/versions`,
    'GET',
    undefined,
    { signal }
  )).data;
}

export async function createClinicalEncounter(
  input: {
    readonly patientUserId: string;
    readonly startedAt: string;
    readonly reason?: string;
    readonly noteContent: string;
  },
  idempotencyKey: string
): Promise<ClinicalRecord> {
  return (await apiV1Request<Envelope<ClinicalRecord>>(
    '/clinical/encounters',
    'POST',
    input,
    { idempotencyKey }
  )).data;
}

export async function updateClinicalDraft(
  noteId: string,
  expectedVersion: number,
  content: string,
  idempotencyKey: string
): Promise<ClinicalRecord> {
  return (await apiV1Request<Envelope<ClinicalRecord>>(
    `/clinical/notes/${encodeURIComponent(noteId)}/draft`,
    'PUT',
    { expectedVersion, content },
    { idempotencyKey }
  )).data;
}

export async function signClinicalNote(
  noteId: string,
  expectedVersion: number,
  idempotencyKey: string
): Promise<ClinicalRecord> {
  return (await apiV1Request<Envelope<ClinicalRecord>>(
    `/clinical/notes/${encodeURIComponent(noteId)}/sign`,
    'POST',
    { expectedVersion },
    { idempotencyKey }
  )).data;
}

export async function amendClinicalNote(
  noteId: string,
  input: { readonly expectedVersion: number; readonly content: string; readonly reason: string },
  idempotencyKey: string
): Promise<ClinicalRecord> {
  return (await apiV1Request<Envelope<ClinicalRecord>>(
    `/clinical/notes/${encodeURIComponent(noteId)}/amendments`,
    'POST',
    input,
    { idempotencyKey }
  )).data;
}

export async function createTreatmentPlan(
  input: {
    readonly patientUserId: string;
    readonly summary: string;
    readonly goals: readonly { readonly description: string; readonly targetDate?: string }[];
  },
  idempotencyKey: string
): Promise<TreatmentPlan> {
  return (await apiV1Request<Envelope<TreatmentPlan>>(
    '/clinical/treatment-plans',
    'POST',
    input,
    { idempotencyKey }
  )).data;
}

export async function transitionTreatmentPlan(
  planId: string,
  transition: TreatmentPlanTransition,
  idempotencyKey: string
): Promise<TreatmentPlan> {
  return (await apiV1Request<Envelope<TreatmentPlan>>(
    `/clinical/treatment-plans/${encodeURIComponent(planId)}/transitions`,
    'POST',
    { transition },
    { idempotencyKey }
  )).data;
}

export async function updateTreatmentGoalStatus(
  goalId: string,
  status: TreatmentGoalStatus,
  idempotencyKey: string
): Promise<TreatmentPlan> {
  return (await apiV1Request<Envelope<TreatmentPlan>>(
    `/clinical/treatment-goals/${encodeURIComponent(goalId)}/status`,
    'PATCH',
    { status },
    { idempotencyKey }
  )).data;
}
