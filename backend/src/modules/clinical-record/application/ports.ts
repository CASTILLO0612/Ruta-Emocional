import { createHash } from 'crypto';
import { AppConfig } from '../../../config/env';
import {
  ClinicalNoteVersionView,
  ClinicalPageQuery,
  ClinicalPatientSummary,
  ClinicalRecordView,
  EncounterCursor,
  Page,
  PatientCursor,
  TreatmentGoalStatusValue,
  TreatmentPlanTransition,
  TreatmentPlanView,
} from '../domain/clinicalRecordTypes';

export interface ClinicalAuditContext {
  readonly actorUserId: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface ClinicalIdempotency {
  readonly key: string;
  readonly requestHash: string;
  readonly now: Date;
  readonly expiresAt: Date;
}

export interface CreateEncounterCommand {
  readonly patientUserId: string;
  readonly appointmentId?: string;
  readonly startedAt: Date;
  readonly endedAt?: Date;
  readonly reason?: string;
  readonly noteContent: string;
}

export interface UpdateDraftCommand {
  readonly expectedVersion: number;
  readonly content: string;
}

export interface SignNoteCommand {
  readonly expectedVersion: number;
}

export interface AmendNoteCommand {
  readonly expectedVersion: number;
  readonly content: string;
  readonly reason: string;
}

export interface CreateTreatmentPlanCommand {
  readonly patientUserId: string;
  readonly summary: string;
  readonly startsAt?: Date;
  readonly goals: readonly {
    readonly description: string;
    readonly targetDate?: Date;
  }[];
}

export interface ClinicalContentCipher {
  encrypt(plaintext: string, context: string): string;
  decrypt(envelope: string, context: string): string;
}

export interface ClinicalRecordRepository {
  listPatients(
    psychologistUserId: string,
    query: ClinicalPageQuery<PatientCursor>
  ): Promise<Page<ClinicalPatientSummary>>;
  getRecord(
    psychologistUserId: string,
    patientUserId: string,
    query: ClinicalPageQuery<EncounterCursor>,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView>;
  listNoteVersions(
    psychologistUserId: string,
    noteId: string,
    audit: ClinicalAuditContext
  ): Promise<readonly ClinicalNoteVersionView[]>;
  createEncounter(
    psychologistUserId: string,
    command: CreateEncounterCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView>;
  updateDraft(
    psychologistUserId: string,
    noteId: string,
    command: UpdateDraftCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView>;
  signNote(
    psychologistUserId: string,
    noteId: string,
    command: SignNoteCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView>;
  amendNote(
    psychologistUserId: string,
    noteId: string,
    command: AmendNoteCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView>;
  createTreatmentPlan(
    psychologistUserId: string,
    command: CreateTreatmentPlanCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<TreatmentPlanView>;
  transitionTreatmentPlan(
    psychologistUserId: string,
    planId: string,
    transition: TreatmentPlanTransition,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<TreatmentPlanView>;
  updateTreatmentGoal(
    psychologistUserId: string,
    goalId: string,
    status: TreatmentGoalStatusValue,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<TreatmentPlanView>;
}

export type ClinicalPolicy = AppConfig['clinical'];

export function hashClinicalPayload(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input), 'utf8').digest('hex');
}
