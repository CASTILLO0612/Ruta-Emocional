import { Clock } from '../../../shared/application/clock';
import { AppError } from '../../../shared/domain/appError';
import { AuthenticatedActor } from '../../identity/application/identityService';
import {
  AmendNoteCommand,
  ClinicalAuditContext,
  ClinicalIdempotency,
  ClinicalPolicy,
  ClinicalRecordRepository,
  CreateEncounterCommand,
  CreateTreatmentPlanCommand,
  hashClinicalPayload,
  SignNoteCommand,
  UpdateDraftCommand,
} from './ports';
import {
  ClinicalPageQuery,
  EncounterCursor,
  PatientCursor,
  TreatmentGoalStatusValue,
  TreatmentPlanTransition,
} from '../domain/clinicalRecordTypes';

export class ClinicalRecordService {
  constructor(
    private readonly repository: ClinicalRecordRepository,
    private readonly clock: Clock,
    private readonly policy: ClinicalPolicy
  ) {}

  getPolicy(actor: AuthenticatedActor) {
    this.assertClinicalWriter(actor);
    return {
      maximumNoteLength: this.policy.maximumNoteLength,
      maximumEncounterReasonLength: this.policy.maximumEncounterReasonLength,
      maximumTreatmentSummaryLength: this.policy.maximumTreatmentSummaryLength,
      maximumGoalLength: this.policy.maximumGoalLength,
      maximumGoalsPerPlan: this.policy.maximumGoalsPerPlan,
      minimumAmendmentReasonLength: this.policy.minimumAmendmentReasonLength,
      maximumAmendmentReasonLength: this.policy.maximumAmendmentReasonLength,
    };
  }

  listPatients(actor: AuthenticatedActor, query: ClinicalPageQuery<PatientCursor>) {
    this.assertClinicalWriter(actor);
    return this.repository.listPatients(actor.user.id, query);
  }

  getRecord(
    actor: AuthenticatedActor,
    patientUserId: string,
    query: ClinicalPageQuery<EncounterCursor>,
    audit: ClinicalAuditContext
  ) {
    this.assertClinicalWriter(actor);
    return this.repository.getRecord(actor.user.id, patientUserId, query, audit);
  }

  listNoteVersions(actor: AuthenticatedActor, noteId: string, audit: ClinicalAuditContext) {
    this.assertClinicalWriter(actor);
    return this.repository.listNoteVersions(actor.user.id, noteId, audit);
  }

  createEncounter(
    actor: AuthenticatedActor,
    command: CreateEncounterCommand,
    idempotencyKey: string,
    audit: ClinicalAuditContext
  ) {
    this.assertClinicalWriter(actor);
    this.assertEncounterTime(command);
    return this.repository.createEncounter(
      actor.user.id,
      command,
      this.idempotency(idempotencyKey, 'clinical.encounter.create', command),
      audit
    );
  }

  updateDraft(
    actor: AuthenticatedActor,
    noteId: string,
    command: UpdateDraftCommand,
    idempotencyKey: string,
    audit: ClinicalAuditContext
  ) {
    this.assertClinicalWriter(actor);
    return this.repository.updateDraft(
      actor.user.id,
      noteId,
      command,
      this.idempotency(idempotencyKey, 'clinical.note.draft.update', { noteId, ...command }),
      audit
    );
  }

  signNote(
    actor: AuthenticatedActor,
    noteId: string,
    command: SignNoteCommand,
    idempotencyKey: string,
    audit: ClinicalAuditContext
  ) {
    this.assertClinicalWriter(actor);
    return this.repository.signNote(
      actor.user.id,
      noteId,
      command,
      this.idempotency(idempotencyKey, 'clinical.note.sign', { noteId, ...command }),
      audit
    );
  }

  amendNote(
    actor: AuthenticatedActor,
    noteId: string,
    command: AmendNoteCommand,
    idempotencyKey: string,
    audit: ClinicalAuditContext
  ) {
    this.assertClinicalWriter(actor);
    return this.repository.amendNote(
      actor.user.id,
      noteId,
      command,
      this.idempotency(idempotencyKey, 'clinical.note.amend', { noteId, ...command }),
      audit
    );
  }

  createTreatmentPlan(
    actor: AuthenticatedActor,
    command: CreateTreatmentPlanCommand,
    idempotencyKey: string,
    audit: ClinicalAuditContext
  ) {
    this.assertClinicalWriter(actor);
    return this.repository.createTreatmentPlan(
      actor.user.id,
      command,
      this.idempotency(idempotencyKey, 'clinical.treatment_plan.create', command),
      audit
    );
  }

  transitionTreatmentPlan(
    actor: AuthenticatedActor,
    planId: string,
    transition: TreatmentPlanTransition,
    idempotencyKey: string,
    audit: ClinicalAuditContext
  ) {
    this.assertClinicalWriter(actor);
    return this.repository.transitionTreatmentPlan(
      actor.user.id,
      planId,
      transition,
      this.idempotency(
        idempotencyKey,
        'clinical.treatment_plan.transition',
        { planId, transition }
      ),
      audit
    );
  }

  updateTreatmentGoal(
    actor: AuthenticatedActor,
    goalId: string,
    status: TreatmentGoalStatusValue,
    idempotencyKey: string,
    audit: ClinicalAuditContext
  ) {
    this.assertClinicalWriter(actor);
    return this.repository.updateTreatmentGoal(
      actor.user.id,
      goalId,
      status,
      this.idempotency(idempotencyKey, 'clinical.treatment_goal.update', { goalId, status }),
      audit
    );
  }

  private assertClinicalWriter(actor: AuthenticatedActor): void {
    if (!actor.user.capabilities.includes('clinical:write:authorized')) {
      throw AppError.forbidden('CLINICAL_CAPABILITY_REQUIRED');
    }
  }

  private assertEncounterTime(command: CreateEncounterCommand): void {
    const now = this.clock.now();
    const futureLimit = now.getTime() + this.policy.encounterFutureSkewMinutes * 60_000;
    if (command.startedAt.getTime() > futureLimit) {
      throw AppError.validation([{
        field: 'startedAt',
        code: 'ENCOUNTER_START_IN_FUTURE',
        message: 'El encuentro no puede registrarse en una fecha futura.',
      }]);
    }
    if (command.endedAt) {
      const duration = command.endedAt.getTime() - command.startedAt.getTime();
      if (duration <= 0 || duration > this.policy.maximumEncounterDurationMinutes * 60_000) {
        throw AppError.validation([{
          field: 'endedAt',
          code: 'INVALID_ENCOUNTER_DURATION',
          message: 'La duración del encuentro no está permitida.',
        }]);
      }
    }
  }

  private idempotency(key: string, operation: string, payload: unknown): ClinicalIdempotency {
    const now = this.clock.now();
    return {
      key,
      requestHash: hashClinicalPayload({ operation, payload }),
      now,
      expiresAt: new Date(now.getTime() + this.policy.idempotencyTtlHours * 3_600_000),
    };
  }
}
