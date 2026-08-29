import { randomUUID } from 'crypto';
import {
  AccountStatus,
  CareRelationshipStatus,
  ClinicalNoteEventType,
  ClinicalNoteStatus,
  ClinicalRecordStatus,
  Prisma,
  PrismaClient,
  TreatmentGoalStatus,
  TreatmentPlanStatus,
  VerificationStatus,
} from '../../../../generated/prisma/client';
import { AppError } from '../../../../shared/domain/appError';
import {
  AmendNoteCommand,
  ClinicalAuditContext,
  ClinicalContentCipher,
  ClinicalIdempotency,
  ClinicalRecordRepository,
  CreateEncounterCommand,
  CreateTreatmentPlanCommand,
  SignNoteCommand,
  UpdateDraftCommand,
} from '../../application/ports';
import {
  ClinicalNoteVersionView,
  ClinicalPageQuery,
  ClinicalPatientSummary,
  ClinicalRecordView,
  encodeEncounterCursor,
  encodePatientCursor,
  EncounterCursor,
  Page,
  PatientCursor,
  TreatmentGoalStatusValue,
  TreatmentPlanTransition,
  TreatmentPlanView,
} from '../../domain/clinicalRecordTypes';

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

interface PatientRow {
  readonly patientUserId: string;
  readonly careRelationshipId: string;
  readonly displayName: string;
  readonly normalizedName: string;
  readonly photoUrl: string | null;
  readonly recordId: string | null;
  readonly recordStatus: 'OPEN' | 'CLOSED' | 'ARCHIVED' | null;
  readonly lastEncounterAt: Date | null;
  readonly draftNotesCount: bigint;
}

const recordInclude = {
  patientProfile: { include: { user: true } },
  encounters: {
    include: {
      appointmentLink: true,
      notes: {
        include: {
          versions: { orderBy: { versionNumber: 'desc' as const }, take: 1 },
        },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
      },
    },
    orderBy: [{ startedAt: 'desc' as const }, { id: 'desc' as const }],
  },
  treatmentPlans: {
    include: { goals: { orderBy: { id: 'asc' as const } } },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  },
} satisfies Prisma.ClinicalRecordInclude;

type RecordRow = Prisma.ClinicalRecordGetPayload<{ include: typeof recordInclude }>;

const noteAccessInclude = {
  versions: { orderBy: { versionNumber: 'desc' as const }, take: 1 },
  clinicalEncounter: {
    include: {
      clinicalRecord: { include: { patientProfile: true } },
      psychologistProfile: true,
      careRelationship: true,
    },
  },
} satisfies Prisma.ClinicalNoteInclude;

type NoteAccessRow = Prisma.ClinicalNoteGetPayload<{ include: typeof noteAccessInclude }>;

const planInclude = {
  goals: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.TreatmentPlanInclude;

type PlanRow = Prisma.TreatmentPlanGetPayload<{ include: typeof planInclude }>;

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  const metadata = typeof error.meta === 'object' && error.meta !== null
    ? JSON.stringify(error.meta)
    : '';
  return error.code === 'P2010' && metadata.includes('40001');
}

function isUniqueConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const metadata = typeof error.meta === 'object' && error.meta !== null
    ? JSON.stringify(error.meta)
    : '';
  return error.code === 'P2002'
    || metadata.includes('treatment_plans_one_open_per_professional_record_idx');
}

export class PrismaClinicalRecordRepository implements ClinicalRecordRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cipher: ClinicalContentCipher,
    private readonly options: {
      readonly maximumRetries: number;
      readonly baseDelayMs: number;
      readonly projectionLimit: number;
    }
  ) {}

  async listPatients(
    psychologistUserId: string,
    query: ClinicalPageQuery<PatientCursor>
  ): Promise<Page<ClinicalPatientSummary>> {
    const cursor = query.cursor
      ? Prisma.sql`AND (lower(patient_user."display_name"), patient_user."id")
          > (${query.cursor.normalizedName}, ${query.cursor.id}::uuid)`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<PatientRow[]>(Prisma.sql`
      SELECT
        patient_user."id" AS "patientUserId",
        relationship."id" AS "careRelationshipId",
        patient_user."display_name" AS "displayName",
        lower(patient_user."display_name") AS "normalizedName",
        patient_user."photo_url" AS "photoUrl",
        record."id" AS "recordId",
        record."status" AS "recordStatus",
        latest."started_at" AS "lastEncounterAt",
        COALESCE(drafts."count", 0)::bigint AS "draftNotesCount"
      FROM "care_relationships" relationship
      JOIN "psychologist_profiles" psychologist
        ON psychologist."id" = relationship."psychologist_profile_id"
      JOIN "patient_profiles" patient
        ON patient."id" = relationship."patient_profile_id"
      JOIN "users" patient_user ON patient_user."id" = patient."user_id"
      LEFT JOIN "clinical_records" record ON record."patient_profile_id" = patient."id"
      LEFT JOIN LATERAL (
        SELECT encounter."started_at"
          FROM "clinical_encounters" encounter
         WHERE encounter."clinical_record_id" = record."id"
           AND encounter."psychologist_profile_id" = psychologist."id"
         ORDER BY encounter."started_at" DESC, encounter."id" DESC
         LIMIT 1
      ) latest ON true
      LEFT JOIN LATERAL (
        SELECT count(*)
          FROM "clinical_notes" note
          JOIN "clinical_encounters" encounter
            ON encounter."id" = note."clinical_encounter_id"
         WHERE encounter."clinical_record_id" = record."id"
           AND encounter."psychologist_profile_id" = psychologist."id"
           AND note."status" = 'DRAFT'
      ) drafts ON true
      WHERE psychologist."user_id" = ${psychologistUserId}::uuid
        AND psychologist."verification_status" = 'VERIFIED'
        AND relationship."status" = 'ACTIVE'
        AND patient_user."status" = 'ACTIVE'
        ${cursor}
      ORDER BY "normalizedName" ASC, patient_user."id" ASC
      LIMIT ${query.limit + 1}
    `);
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => ({
        patientUserId: row.patientUserId,
        careRelationshipId: row.careRelationshipId,
        displayName: row.displayName,
        photoUrl: row.photoUrl,
        recordId: row.recordId,
        recordStatus: row.recordStatus,
        lastEncounterAt: row.lastEncounterAt?.toISOString() ?? null,
        draftNotesCount: Number(row.draftNotesCount),
      })),
      nextCursor: hasMore && last
        ? encodePatientCursor({ normalizedName: last.normalizedName, id: last.patientUserId })
        : null,
    };
  }

  async getRecord(
    psychologistUserId: string,
    patientUserId: string,
    query: ClinicalPageQuery<EncounterCursor>,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView> {
    return this.prisma.$transaction(async (transaction) => {
      const relationship = await this.requireActiveRelationship(
        transaction,
        psychologistUserId,
        patientUserId
      );
      const view = await this.loadRecordView(transaction, relationship, query);
      await this.writeAudit(
        transaction,
        audit,
        'clinical_record.read',
        view.id ?? patientUserId,
        'clinical_record',
        {
          patientUserId,
          relationshipId: relationship.id,
          scope: 'SELF_AUTHORED',
          returnedEncounters: view.encounters.length,
        }
      );
      return view;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async listNoteVersions(
    psychologistUserId: string,
    noteId: string,
    audit: ClinicalAuditContext
  ): Promise<readonly ClinicalNoteVersionView[]> {
    return this.prisma.$transaction(async (transaction) => {
      await this.requireAccessibleNote(transaction, psychologistUserId, noteId);
      const versions = await transaction.clinicalNoteVersion.findMany({
        where: { clinicalNoteId: noteId },
        include: { author: true },
        orderBy: { versionNumber: 'desc' },
      });
      await this.writeAudit(transaction, audit, 'clinical_note.versions_read', noteId, 'clinical_note', {
        versionCount: versions.length,
      });
      return versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        content: this.decrypt(version.clinicalNoteId, version.versionNumber, version.content),
        amendmentReason: version.amendmentReason
          ? this.cipher.decrypt(
            version.amendmentReason,
            `clinical-note:${version.clinicalNoteId}:version:${version.versionNumber}:amendment-reason`
          )
          : null,
        createdAt: version.createdAt.toISOString(),
        author: { userId: version.author.id, displayName: version.author.displayName },
      }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async createEncounter(
    psychologistUserId: string,
    command: CreateEncounterCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView> {
    const operation = 'clinical.encounter.create';
    const result = await this.withSerializableRetry(async (transaction) => {
      await this.lockOperation(transaction, psychologistUserId, operation, idempotency.key);
      const replay = await this.findIdempotentResource(
        transaction,
        psychologistUserId,
        operation,
        idempotency
      );
      if (replay) {
        const encounter = await transaction.clinicalEncounter.findUnique({
          where: { id: replay },
          include: { clinicalRecord: { include: { patientProfile: true } } },
        });
        if (!encounter) throw AppError.conflict('IDEMPOTENT_RESOURCE_MISSING', 'El recurso ya no está disponible.');
        return { patientProfileId: encounter.clinicalRecord.patientProfileId };
      }

      const relationship = await this.requireActiveRelationship(
        transaction,
        psychologistUserId,
        command.patientUserId
      );
      if (command.appointmentId) {
        const appointment = await transaction.appointment.findFirst({
          where: {
            id: command.appointmentId,
            patientProfileId: relationship.patientProfileId,
            psychologistProfileId: relationship.psychologistProfileId,
            status: { in: ['IN_PROGRESS', 'COMPLETED'] },
          },
          select: { id: true },
        });
        if (!appointment) throw AppError.notFound('CLINICAL_APPOINTMENT_NOT_FOUND');
      }
      const record = await transaction.clinicalRecord.upsert({
        where: { patientProfileId: relationship.patientProfileId },
        update: {},
        create: { patientProfileId: relationship.patientProfileId },
      });
      if (record.status !== ClinicalRecordStatus.OPEN) {
        throw AppError.conflict('CLINICAL_RECORD_NOT_OPEN', 'El expediente clínico no está abierto.');
      }

      const encounterId = randomUUID();
      const noteId = randomUUID();
      await transaction.clinicalEncounter.create({
        data: {
          id: encounterId,
          clinicalRecordId: record.id,
          psychologistProfileId: relationship.psychologistProfileId,
          careRelationshipId: relationship.id,
          startedAt: command.startedAt,
          endedAt: command.endedAt,
          reason: command.reason
            ? this.cipher.encrypt(command.reason, `clinical-encounter:${encounterId}:reason`)
            : undefined,
          ...(command.appointmentId ? {
            appointmentLink: { create: { appointmentId: command.appointmentId } },
          } : {}),
        },
      });
      await transaction.clinicalNote.create({
        data: {
          id: noteId,
          clinicalEncounterId: encounterId,
          versions: {
            create: {
              versionNumber: 1,
              authorUserId: psychologistUserId,
              content: this.encrypt(noteId, 1, command.noteContent),
            },
          },
          events: {
            create: {
              actorUserId: psychologistUserId,
              type: ClinicalNoteEventType.CREATED,
              toStatus: ClinicalNoteStatus.DRAFT,
              versionNumber: 1,
            },
          },
        },
      });
      await this.recordIdempotency(
        transaction,
        psychologistUserId,
        operation,
        idempotency,
        encounterId
      );
      await this.writeAudit(transaction, audit, 'clinical_encounter.created', encounterId, 'clinical_encounter', {
        patientUserId: command.patientUserId,
        relationshipId: relationship.id,
        noteId,
        appointmentLinked: Boolean(command.appointmentId),
      });
      return { patientProfileId: relationship.patientProfileId };
    });
    return this.loadRecordByPatientProfile(psychologistUserId, result.patientProfileId);
  }

  async updateDraft(
    psychologistUserId: string,
    noteId: string,
    command: UpdateDraftCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView> {
    return this.mutateNote(
      psychologistUserId,
      noteId,
      'clinical.note.draft.update',
      idempotency,
      audit,
      async (transaction, note) => {
        if (note.status !== ClinicalNoteStatus.DRAFT) {
          throw AppError.conflict('CLINICAL_NOTE_NOT_DRAFT', 'Solo una nota en borrador puede editarse.');
        }
        const latest = this.requireExpectedVersion(note, command.expectedVersion);
        const versionNumber = latest.versionNumber + 1;
        await transaction.clinicalNoteVersion.create({
          data: {
            clinicalNoteId: noteId,
            versionNumber,
            authorUserId: psychologistUserId,
            content: this.encrypt(noteId, versionNumber, command.content),
          },
        });
        await transaction.clinicalNote.update({ where: { id: noteId }, data: { updatedAt: idempotency.now } });
        await transaction.clinicalNoteEvent.create({
          data: {
            clinicalNoteId: noteId,
            actorUserId: psychologistUserId,
            type: ClinicalNoteEventType.DRAFT_UPDATED,
            fromStatus: ClinicalNoteStatus.DRAFT,
            toStatus: ClinicalNoteStatus.DRAFT,
            versionNumber,
          },
        });
        return { action: 'clinical_note.draft_updated', versionNumber };
      }
    );
  }

  async signNote(
    psychologistUserId: string,
    noteId: string,
    command: SignNoteCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView> {
    return this.mutateNote(
      psychologistUserId,
      noteId,
      'clinical.note.sign',
      idempotency,
      audit,
      async (transaction, note) => {
        if (note.status !== ClinicalNoteStatus.DRAFT) {
          throw AppError.conflict('CLINICAL_NOTE_ALREADY_SIGNED', 'La nota ya fue firmada.');
        }
        const latest = this.requireExpectedVersion(note, command.expectedVersion);
        await transaction.clinicalNote.update({
          where: { id: noteId },
          data: { status: ClinicalNoteStatus.SIGNED, signedAt: idempotency.now, updatedAt: idempotency.now },
        });
        await transaction.clinicalNoteEvent.create({
          data: {
            clinicalNoteId: noteId,
            actorUserId: psychologistUserId,
            type: ClinicalNoteEventType.SIGNED,
            fromStatus: ClinicalNoteStatus.DRAFT,
            toStatus: ClinicalNoteStatus.SIGNED,
            versionNumber: latest.versionNumber,
          },
        });
        return { action: 'clinical_note.signed', versionNumber: latest.versionNumber };
      }
    );
  }

  async amendNote(
    psychologistUserId: string,
    noteId: string,
    command: AmendNoteCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<ClinicalRecordView> {
    return this.mutateNote(
      psychologistUserId,
      noteId,
      'clinical.note.amend',
      idempotency,
      audit,
      async (transaction, note) => {
        if (
          note.status !== ClinicalNoteStatus.SIGNED
          && note.status !== ClinicalNoteStatus.AMENDED
        ) {
          throw AppError.conflict('CLINICAL_NOTE_NOT_SIGNED', 'La nota debe estar firmada antes de enmendarse.');
        }
        const latest = this.requireExpectedVersion(note, command.expectedVersion);
        const versionNumber = latest.versionNumber + 1;
        await transaction.clinicalNoteVersion.create({
          data: {
            clinicalNoteId: noteId,
            versionNumber,
            authorUserId: psychologistUserId,
            content: this.encrypt(noteId, versionNumber, command.content),
            amendmentReason: this.cipher.encrypt(
              command.reason,
              `clinical-note:${noteId}:version:${versionNumber}:amendment-reason`
            ),
          },
        });
        await transaction.clinicalNote.update({
          where: { id: noteId },
          data: { status: ClinicalNoteStatus.AMENDED, updatedAt: idempotency.now },
        });
        await transaction.clinicalNoteEvent.create({
          data: {
            clinicalNoteId: noteId,
            actorUserId: psychologistUserId,
            type: ClinicalNoteEventType.AMENDED,
            fromStatus: note.status,
            toStatus: ClinicalNoteStatus.AMENDED,
            versionNumber,
          },
        });
        return { action: 'clinical_note.amended', versionNumber };
      }
    );
  }

  async createTreatmentPlan(
    psychologistUserId: string,
    command: CreateTreatmentPlanCommand,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<TreatmentPlanView> {
    const operation = 'clinical.treatment_plan.create';
    try {
      const planId = await this.withSerializableRetry(async (transaction) => {
        await this.lockOperation(transaction, psychologistUserId, operation, idempotency.key);
        const replay = await this.findIdempotentResource(
          transaction,
          psychologistUserId,
          operation,
          idempotency
        );
        if (replay) return replay;
        const relationship = await this.requireActiveRelationship(
          transaction,
          psychologistUserId,
          command.patientUserId
        );
        const record = await transaction.clinicalRecord.upsert({
          where: { patientProfileId: relationship.patientProfileId },
          update: {},
          create: { patientProfileId: relationship.patientProfileId },
        });
        if (record.status !== ClinicalRecordStatus.OPEN) {
          throw AppError.conflict('CLINICAL_RECORD_NOT_OPEN', 'El expediente clínico no está abierto.');
        }
        const planId = randomUUID();
        const goals = command.goals.map((goal) => {
          const id = randomUUID();
          return {
            id,
            description: this.cipher.encrypt(goal.description, `treatment-goal:${id}:description`),
            targetDate: goal.targetDate,
          };
        });
        const created = await transaction.treatmentPlan.create({
          data: {
            id: planId,
            clinicalRecordId: record.id,
            psychologistProfileId: relationship.psychologistProfileId,
            summary: this.cipher.encrypt(command.summary, `treatment-plan:${planId}:summary`),
            startsAt: command.startsAt ?? idempotency.now,
            goals: { create: goals },
          },
        });
        await this.recordIdempotency(transaction, psychologistUserId, operation, idempotency, created.id);
        await this.writeAudit(transaction, audit, 'clinical_treatment_plan.created', created.id, 'treatment_plan', {
          patientUserId: command.patientUserId,
          relationshipId: relationship.id,
          goalCount: command.goals.length,
        });
        return created.id;
      });
      return this.loadAuthorizedPlan(psychologistUserId, planId);
    } catch (error) {
      if (isUniqueConflict(error)) {
        throw AppError.conflict(
          'OPEN_TREATMENT_PLAN_EXISTS',
          'Ya existe un plan de tratamiento abierto para este paciente.'
        );
      }
      throw error;
    }
  }

  async transitionTreatmentPlan(
    psychologistUserId: string,
    planId: string,
    transition: TreatmentPlanTransition,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<TreatmentPlanView> {
    const operation = `clinical.treatment_plan.${transition.toLowerCase()}`;
    await this.withSerializableRetry(async (transaction) => {
      await this.lockOperation(transaction, psychologistUserId, operation, idempotency.key);
      const replay = await this.findIdempotentResource(transaction, psychologistUserId, operation, idempotency);
      if (replay) return;
      const plan = await this.requireAuthorizedPlan(transaction, psychologistUserId, planId);
      const next = this.nextPlanStatus(plan.status, transition);
      await transaction.treatmentPlan.update({
        where: { id: planId },
        data: {
          status: next,
          endsAt: next === TreatmentPlanStatus.COMPLETED || next === TreatmentPlanStatus.CANCELLED
            ? idempotency.now
            : null,
          updatedAt: idempotency.now,
        },
      });
      await this.recordIdempotency(transaction, psychologistUserId, operation, idempotency, planId);
      await this.writeAudit(transaction, audit, 'clinical_treatment_plan.status_changed', planId, 'treatment_plan', {
        fromStatus: plan.status,
        toStatus: next,
      });
    });
    return this.loadAuthorizedPlan(psychologistUserId, planId);
  }

  async updateTreatmentGoal(
    psychologistUserId: string,
    goalId: string,
    status: TreatmentGoalStatusValue,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext
  ): Promise<TreatmentPlanView> {
    const operation = 'clinical.treatment_goal.update';
    const planId = await this.withSerializableRetry(async (transaction) => {
      await this.lockOperation(transaction, psychologistUserId, operation, idempotency.key);
      const replay = await this.findIdempotentResource(transaction, psychologistUserId, operation, idempotency);
      if (replay) {
        const goal = await transaction.treatmentGoal.findUnique({ where: { id: replay } });
        if (!goal) throw AppError.conflict('IDEMPOTENT_RESOURCE_MISSING', 'El recurso ya no está disponible.');
        return goal.treatmentPlanId;
      }
      const goal = await transaction.treatmentGoal.findUnique({
        where: { id: goalId },
        include: { treatmentPlan: true },
      });
      if (!goal) throw AppError.notFound('TREATMENT_GOAL_NOT_FOUND');
      await this.requireAuthorizedPlan(transaction, psychologistUserId, goal.treatmentPlanId);
      if (
        goal.treatmentPlan.status !== TreatmentPlanStatus.DRAFT
        && goal.treatmentPlan.status !== TreatmentPlanStatus.ACTIVE
      ) {
        throw AppError.conflict('TREATMENT_PLAN_CLOSED', 'El plan de tratamiento ya está cerrado.');
      }
      this.assertGoalTransition(goal.status, status);
      await transaction.treatmentGoal.update({
        where: { id: goalId },
        data: { status: status as TreatmentGoalStatus },
      });
      await transaction.treatmentPlan.update({
        where: { id: goal.treatmentPlanId },
        data: { updatedAt: idempotency.now },
      });
      await this.recordIdempotency(transaction, psychologistUserId, operation, idempotency, goalId);
      await this.writeAudit(transaction, audit, 'clinical_treatment_goal.status_changed', goalId, 'treatment_goal', {
        treatmentPlanId: goal.treatmentPlanId,
        fromStatus: goal.status,
        toStatus: status,
      });
      return goal.treatmentPlanId;
    });
    return this.loadAuthorizedPlan(psychologistUserId, planId);
  }

  private async mutateNote(
    psychologistUserId: string,
    noteId: string,
    operation: string,
    idempotency: ClinicalIdempotency,
    audit: ClinicalAuditContext,
    mutation: (
      transaction: Prisma.TransactionClient,
      note: NoteAccessRow
    ) => Promise<{ readonly action: string; readonly versionNumber: number }>
  ): Promise<ClinicalRecordView> {
    const patientProfileId = await this.withSerializableRetry(async (transaction) => {
      await this.lockOperation(transaction, psychologistUserId, operation, idempotency.key);
      const replay = await this.findIdempotentResource(transaction, psychologistUserId, operation, idempotency);
      const note = await this.requireAccessibleNote(transaction, psychologistUserId, replay ?? noteId, true);
      if (replay) return note.clinicalEncounter.clinicalRecord.patientProfileId;
      const result = await mutation(transaction, note);
      await this.recordIdempotency(transaction, psychologistUserId, operation, idempotency, noteId);
      await this.writeAudit(transaction, audit, result.action, noteId, 'clinical_note', {
        versionNumber: result.versionNumber,
        encounterId: note.clinicalEncounterId,
      });
      return note.clinicalEncounter.clinicalRecord.patientProfileId;
    });
    return this.loadRecordByPatientProfile(psychologistUserId, patientProfileId);
  }

  private async loadRecordByPatientProfile(
    psychologistUserId: string,
    patientProfileId: string
  ): Promise<ClinicalRecordView> {
    const patient = await this.prisma.patientProfile.findUniqueOrThrow({
      where: { id: patientProfileId },
      select: { userId: true },
    });
    const relationship = await this.requireActiveRelationship(
      this.prisma,
      psychologistUserId,
      patient.userId
    );
    return this.loadRecordView(this.prisma, relationship, {
      limit: this.options.projectionLimit,
    });
  }

  private async loadRecordView(
    client: DatabaseClient,
    relationship: Awaited<ReturnType<PrismaClinicalRecordRepository['requireActiveRelationship']>>,
    query: ClinicalPageQuery<EncounterCursor>
  ): Promise<ClinicalRecordView> {
    const record = await client.clinicalRecord.findUnique({
      where: { patientProfileId: relationship.patientProfileId },
      include: {
        ...recordInclude,
        encounters: {
          ...recordInclude.encounters,
          where: {
            psychologistProfileId: relationship.psychologistProfileId,
            careRelationshipId: relationship.id,
            ...(query.cursor ? {
              OR: [
                { startedAt: { lt: query.cursor.startedAt } },
                { startedAt: query.cursor.startedAt, id: { lt: query.cursor.id } },
              ],
            } : {}),
          },
          take: query.limit + 1,
        },
        treatmentPlans: {
          ...recordInclude.treatmentPlans,
          where: { psychologistProfileId: relationship.psychologistProfileId },
          take: this.options.projectionLimit,
        },
      },
    });
    const patient = relationship.patientProfile.user;
    if (!record) {
      return {
        id: null,
        status: null,
        openedAt: null,
        patient: { userId: patient.id, displayName: patient.displayName, photoUrl: patient.photoUrl },
        careRelationshipId: relationship.id,
        encounters: [],
        treatmentPlans: [],
        nextCursor: null,
      };
    }
    const hasMore = record.encounters.length > query.limit;
    const encounters = hasMore ? record.encounters.slice(0, query.limit) : record.encounters;
    const last = encounters.at(-1);
    return {
      id: record.id,
      status: record.status,
      openedAt: record.openedAt.toISOString(),
      patient: { userId: patient.id, displayName: patient.displayName, photoUrl: patient.photoUrl },
      careRelationshipId: relationship.id,
      encounters: encounters.map((encounter) => {
        const note = encounter.notes[0];
        const latest = note?.versions[0];
        if (!note || !latest) throw new Error('Clinical encounter without a note reached the projection');
        return {
          id: encounter.id,
          careRelationshipId: relationship.id,
          appointmentId: encounter.appointmentLink?.appointmentId ?? null,
          startedAt: encounter.startedAt.toISOString(),
          endedAt: encounter.endedAt?.toISOString() ?? null,
          reason: encounter.reason
            ? this.cipher.decrypt(
              encounter.reason,
              `clinical-encounter:${encounter.id}:reason`
            )
            : null,
          createdAt: encounter.createdAt.toISOString(),
          note: {
            id: note.id,
            status: note.status,
            latestVersionNumber: latest.versionNumber,
            content: this.decrypt(note.id, latest.versionNumber, latest.content),
            signedAt: note.signedAt?.toISOString() ?? null,
            createdAt: note.createdAt.toISOString(),
            updatedAt: note.updatedAt.toISOString(),
          },
        };
      }),
      treatmentPlans: record.treatmentPlans.map((plan) => this.toPlanView(plan)),
      nextCursor: hasMore && last
        ? encodeEncounterCursor({ startedAt: last.startedAt, id: last.id })
        : null,
    };
  }

  private async requireActiveRelationship(
    client: DatabaseClient,
    psychologistUserId: string,
    patientUserId: string
  ) {
    const relationship = await client.careRelationship.findFirst({
      where: {
        status: CareRelationshipStatus.ACTIVE,
        patientProfile: { userId: patientUserId, user: { status: AccountStatus.ACTIVE } },
        psychologistProfile: {
          userId: psychologistUserId,
          verificationStatus: VerificationStatus.VERIFIED,
          user: { status: AccountStatus.ACTIVE },
        },
      },
      include: {
        patientProfile: { include: { user: true } },
        psychologistProfile: true,
      },
    });
    if (!relationship) throw AppError.notFound('CLINICAL_PATIENT_NOT_FOUND');
    return relationship;
  }

  private async requireAccessibleNote(
    client: DatabaseClient,
    psychologistUserId: string,
    noteId: string,
    lock = false
  ): Promise<NoteAccessRow> {
    if (lock) {
      await client.$queryRaw(Prisma.sql`
        SELECT "id" FROM "clinical_notes" WHERE "id" = ${noteId}::uuid FOR UPDATE
      `);
    }
    const note = await client.clinicalNote.findFirst({
      where: {
        id: noteId,
        clinicalEncounter: {
          psychologistProfile: {
            userId: psychologistUserId,
            verificationStatus: VerificationStatus.VERIFIED,
          },
          careRelationship: {
            status: CareRelationshipStatus.ACTIVE,
            psychologistProfile: { userId: psychologistUserId },
          },
        },
      },
      include: noteAccessInclude,
    });
    if (!note) throw AppError.notFound('CLINICAL_NOTE_NOT_FOUND');
    return note;
  }

  private requireExpectedVersion(note: NoteAccessRow, expectedVersion: number) {
    const latest = note.versions[0];
    if (!latest) throw new Error('Clinical note without a version reached mutation');
    if (latest.versionNumber !== expectedVersion) {
      throw AppError.conflict(
        'CLINICAL_NOTE_VERSION_CONFLICT',
        'La nota cambió desde la última lectura. Vuelve a cargarla antes de continuar.'
      );
    }
    return latest;
  }

  private async requireAuthorizedPlan(
    client: DatabaseClient,
    psychologistUserId: string,
    planId: string
  ) {
    const plan = await client.treatmentPlan.findFirst({
      where: {
        id: planId,
        psychologistProfile: {
          userId: psychologistUserId,
          verificationStatus: VerificationStatus.VERIFIED,
        },
        clinicalRecord: {
          patientProfile: {
            careRelationships: {
              some: {
                status: CareRelationshipStatus.ACTIVE,
                psychologistProfile: { userId: psychologistUserId },
              },
            },
          },
        },
      },
    });
    if (!plan) throw AppError.notFound('TREATMENT_PLAN_NOT_FOUND');
    return plan;
  }

  private async loadAuthorizedPlan(psychologistUserId: string, planId: string): Promise<TreatmentPlanView> {
    await this.requireAuthorizedPlan(this.prisma, psychologistUserId, planId);
    const plan = await this.prisma.treatmentPlan.findUniqueOrThrow({
      where: { id: planId },
      include: planInclude,
    });
    return this.toPlanView(plan);
  }

  private toPlanView(plan: PlanRow): TreatmentPlanView {
    return {
      id: plan.id,
      status: plan.status,
      summary: plan.summary
        ? this.cipher.decrypt(plan.summary, `treatment-plan:${plan.id}:summary`)
        : '',
      startsAt: plan.startsAt.toISOString(),
      endsAt: plan.endsAt?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      goals: plan.goals.map((goal) => ({
        id: goal.id,
        description: this.cipher.decrypt(
          goal.description,
          `treatment-goal:${goal.id}:description`
        ),
        targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
        status: goal.status,
      })),
    };
  }

  private nextPlanStatus(current: TreatmentPlanStatus, transition: TreatmentPlanTransition) {
    if (current === TreatmentPlanStatus.DRAFT && transition === 'ACTIVATE') return TreatmentPlanStatus.ACTIVE;
    if (current === TreatmentPlanStatus.DRAFT && transition === 'CANCEL') return TreatmentPlanStatus.CANCELLED;
    if (current === TreatmentPlanStatus.ACTIVE && transition === 'COMPLETE') return TreatmentPlanStatus.COMPLETED;
    if (current === TreatmentPlanStatus.ACTIVE && transition === 'CANCEL') return TreatmentPlanStatus.CANCELLED;
    throw AppError.conflict('INVALID_TREATMENT_PLAN_TRANSITION', 'La transición del plan no está permitida.');
  }

  private assertGoalTransition(
    current: TreatmentGoalStatus,
    next: TreatmentGoalStatusValue
  ): void {
    const allowedTransitions: Readonly<Record<TreatmentGoalStatus, readonly TreatmentGoalStatusValue[]>> = {
      [TreatmentGoalStatus.PENDING]: [TreatmentGoalStatus.IN_PROGRESS, TreatmentGoalStatus.CANCELLED],
      [TreatmentGoalStatus.IN_PROGRESS]: [TreatmentGoalStatus.ACHIEVED, TreatmentGoalStatus.CANCELLED],
      [TreatmentGoalStatus.ACHIEVED]: [],
      [TreatmentGoalStatus.CANCELLED]: [],
    };
    if (!allowedTransitions[current].includes(next)) {
      throw AppError.conflict(
        'INVALID_TREATMENT_GOAL_TRANSITION',
        'La transición del objetivo no está permitida.'
      );
    }
  }

  private encrypt(noteId: string, version: number, content: string): string {
    return this.cipher.encrypt(content, `clinical-note:${noteId}:version:${version}`);
  }

  private decrypt(noteId: string, version: number, content: string): string {
    return this.cipher.decrypt(content, `clinical-note:${noteId}:version:${version}`);
  }

  private async withSerializableRetry<T>(
    operation: (transaction: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (!isSerializationConflict(error) || attempt >= this.options.maximumRetries) throw error;
        const delay = this.options.baseDelayMs * (2 ** attempt);
        const jitter = Math.floor(Math.random() * this.options.baseDelayMs);
        await new Promise<void>((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
  }

  private lockOperation(
    transaction: Prisma.TransactionClient,
    userId: string,
    operation: string,
    key: string
  ) {
    return transaction.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${operation}:${key}`}, 0))
    `);
  }

  private async findIdempotentResource(
    transaction: Prisma.TransactionClient,
    userId: string,
    operation: string,
    idempotency: ClinicalIdempotency
  ): Promise<string | null> {
    const existing = await transaction.idempotencyRecord.findUnique({
      where: {
        actorUserId_operation_idempotencyKey: {
          actorUserId: userId,
          operation,
          idempotencyKey: idempotency.key,
        },
      },
    });
    if (!existing) return null;
    if (existing.expiresAt <= idempotency.now) {
      await transaction.idempotencyRecord.delete({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: userId,
            operation,
            idempotencyKey: idempotency.key,
          },
        },
      });
      return null;
    }
    if (existing.requestHash !== idempotency.requestHash) {
      throw AppError.conflict(
        'IDEMPOTENCY_KEY_REUSED',
        'La clave de idempotencia ya fue utilizada con otro contenido.'
      );
    }
    return existing.resourceId;
  }

  private recordIdempotency(
    transaction: Prisma.TransactionClient,
    userId: string,
    operation: string,
    idempotency: ClinicalIdempotency,
    resourceId: string
  ) {
    return transaction.idempotencyRecord.create({
      data: {
        actorUserId: userId,
        operation,
        idempotencyKey: idempotency.key,
        requestHash: idempotency.requestHash,
        resourceId,
        expiresAt: idempotency.expiresAt,
      },
    });
  }

  private writeAudit(
    transaction: Prisma.TransactionClient,
    audit: ClinicalAuditContext,
    action: string,
    resourceId: string,
    resourceType: string,
    metadata?: Prisma.InputJsonObject
  ) {
    return transaction.auditEvent.create({
      data: {
        actorUserId: audit.actorUserId,
        action,
        resourceType,
        resourceId,
        requestId: audit.requestId,
        ipAddress: audit.ipAddress,
        metadata,
      },
    });
  }
}
