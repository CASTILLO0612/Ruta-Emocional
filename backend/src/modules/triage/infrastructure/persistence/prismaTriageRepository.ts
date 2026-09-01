import {
  AccountStatus,
  ConsentDecision,
  Prisma,
  PrismaClient,
  RequestStatus,
  VerificationStatus,
} from '../../../../generated/prisma/client';
import { AppError } from '../../../../shared/domain/appError';
import {
  PersistTriageAssessmentInput,
  TriageAuditContext,
  TriageIdempotency,
  TriageRepository,
} from '../../application/ports';
import {
  TriageAssessmentRecord,
  TriageDefinition,
  TriageErasureRequestStatusValue,
  TriageModality,
  TriageProviderOutcomeValue,
  TriageRiskLevelValue,
} from '../../domain/triageTypes';

const CREATE_ASSESSMENT_OPERATION = 'triage.assessment.create';

const assessmentInclude = {
  patientProfile: { select: { userId: true } },
  primaryNeed: { select: { code: true, name: true } },
  recommendedModalities: {
    orderBy: { priority: 'asc' as const },
    select: { modality: true },
  },
  reviewedByPsychologist: {
    select: { user: { select: { id: true, displayName: true } } },
  },
  consentWithdrawal: { select: { withdrawnAt: true } },
  erasureRequest: {
    select: {
      id: true,
      status: true,
      policyVersion: true,
      requestedAt: true,
      dueAt: true,
      resolvedAt: true,
    },
  },
} satisfies Prisma.TriageAssessmentInclude;

type AssessmentRow = Prisma.TriageAssessmentGetPayload<{ include: typeof assessmentInclude }>;

export class PrismaTriageRepository implements TriageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getDefinition(
    consentDocumentCode: string,
    consentDocumentVersion: string,
    now: Date
  ): Promise<TriageDefinition> {
    const [consentDocument, questions, needs, rules] = await Promise.all([
      this.prisma.consentDocument.findFirst({
        where: {
          code: consentDocumentCode,
          version: consentDocumentVersion,
          scope: 'TRIAGE_ORIENTATION',
          isActive: true,
          publishedAt: { lte: now },
          content: { not: null },
        },
        select: {
          id: true,
          code: true,
          version: true,
          title: true,
          content: true,
          contentHash: true,
        },
      }),
      this.prisma.triageQuestion.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
        include: {
          options: {
            where: { isActive: true },
            orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
          },
        },
      }),
      this.prisma.triageNeed.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
        include: { modalities: { orderBy: { priority: 'asc' } } },
      }),
      this.prisma.triageRule.findMany({
        where: {
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
        orderBy: [{ code: 'asc' }, { version: 'asc' }],
      }),
    ]);

    if (!consentDocument?.content || !questions.length || !needs.length || !rules.length) {
      throw AppError.conflict(
        'TRIAGE_DEFINITION_UNAVAILABLE',
        'La definición de orientación segura no está completa.'
      );
    }
    if (questions.some((question) => question.isRequired && question.options.length === 0)) {
      throw AppError.conflict(
        'TRIAGE_DEFINITION_INVALID',
        'Una pregunta obligatoria no tiene opciones vigentes.'
      );
    }

    return {
      consentDocument: {
        ...consentDocument,
        content: consentDocument.content,
      },
      questions: questions.map((question) => ({
        code: question.code,
        prompt: question.prompt,
        helpText: question.helpText,
        displayOrder: question.displayOrder,
        isRequired: question.isRequired,
        options: question.options.map((option) => ({
          code: option.code,
          questionCode: option.questionCode,
          label: option.label,
          helpText: option.helpText,
          needCode: option.needCode,
          modality: option.modality as TriageModality | null,
          displayOrder: option.displayOrder,
        })),
      })),
      needs: needs.map((need) => ({
        code: need.code,
        name: need.name,
        description: need.description,
        fallbackSummary: need.fallbackSummary,
        modalities: need.modalities.map((modality) => ({
          modality: modality.modality as TriageModality,
          priority: modality.priority,
        })),
      })),
      rules: rules.map((rule) => ({
        id: rule.id,
        code: rule.code,
        version: rule.version,
        name: rule.name,
        triggerOptionCode: rule.triggerOptionCode,
        riskLevel: rule.riskLevel as TriageRiskLevelValue,
      })),
    };
  }

  async createAssessment(
    patientUserId: string,
    input: PersistTriageAssessmentInput,
    idempotency: TriageIdempotency,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOperation(
        transaction,
        patientUserId,
        CREATE_ASSESSMENT_OPERATION,
        idempotency.key
      );
      const replay = await transaction.idempotencyRecord.findUnique({
        where: {
          actorUserId_operation_idempotencyKey: {
            actorUserId: patientUserId,
            operation: CREATE_ASSESSMENT_OPERATION,
            idempotencyKey: idempotency.key,
          },
        },
      });
      if (replay) {
        if (replay.requestHash !== idempotency.requestHash) {
          throw AppError.conflict(
            'IDEMPOTENCY_KEY_REUSED',
            'La clave de idempotencia ya fue usada con otro contenido.'
          );
        }
        const existing = await transaction.triageAssessment.findUnique({
          where: { id: replay.resourceId },
          include: assessmentInclude,
        });
        if (!existing) {
          throw AppError.conflict(
            'IDEMPOTENCY_RESOURCE_MISSING',
            'El resultado previo ya no está disponible.'
          );
        }
        return this.toRecord(existing);
      }

      const patient = await transaction.patientProfile.findFirst({
        where: { userId: patientUserId, user: { status: AccountStatus.ACTIVE } },
        select: { id: true },
      });
      if (!patient) throw AppError.forbidden('PATIENT_PROFILE_REQUIRED');

      if (input.serviceRequestId) {
        const request = await transaction.serviceRequest.findFirst({
          where: {
            id: input.serviceRequestId,
            patientProfileId: patient.id,
            status: { in: [RequestStatus.PENDING, RequestStatus.BIDDING] },
          },
          select: { id: true },
        });
        if (!request) {
          throw AppError.notFound(
            'SERVICE_REQUEST_NOT_FOUND',
            'La solicitud no existe, no te pertenece o ya no admite una evaluación.'
          );
        }
      }

      const consentDocument = await transaction.consentDocument.findFirst({
        where: {
          id: input.consentDocumentId,
          scope: 'TRIAGE_ORIENTATION',
          isActive: true,
        },
        select: { id: true },
      });
      if (!consentDocument) {
        throw AppError.conflict(
          'TRIAGE_CONSENT_UNAVAILABLE',
          'El consentimiento vigente ya no está disponible.'
        );
      }
      const consent = await transaction.patientConsent.create({
        data: {
          patientProfileId: patient.id,
          consentDocumentId: consentDocument.id,
          decision: ConsentDecision.GRANTED,
          occurredAt: idempotency.now,
          ipAddress: audit.ipAddress,
        },
        select: { id: true },
      });

      const assessment = await transaction.triageAssessment.create({
        data: {
          patientProfileId: patient.id,
          consentDecisionId: consent.id,
          primaryNeedCode: input.primaryNeedCode,
          provider: input.provider,
          model: input.model,
          evaluatorVersion: input.evaluatorVersion,
          providerOutcome: input.providerOutcome,
          countryCode: input.countryCode,
          orientationSummary: input.orientationSummary,
          riskLevel: input.riskLevel,
          recommendedModalities: {
            create: input.recommendedModalities.map((modality, index) => ({
              modality,
              priority: index + 1,
            })),
          },
          ruleResults: {
            create: input.ruleResults.map((result) => ({
              triageRuleId: result.ruleId,
              matched: result.matched,
              evidenceOptionCode: result.evidenceOptionCode,
            })),
          },
          ...(input.serviceRequestId
            ? { requestLink: { create: { serviceRequestId: input.serviceRequestId } } }
            : {}),
        },
        include: assessmentInclude,
      });

      await this.writeAudit(
        transaction,
        audit,
        'triage.assessment_created',
        assessment.id,
        {
          evaluatorVersion: input.evaluatorVersion,
          providerOutcome: input.providerOutcome,
          linkedToServiceRequest: Boolean(input.serviceRequestId),
        }
      );
      await transaction.idempotencyRecord.create({
        data: {
          actorUserId: patientUserId,
          operation: CREATE_ASSESSMENT_OPERATION,
          idempotencyKey: idempotency.key,
          requestHash: idempotency.requestHash,
          resourceId: assessment.id,
          expiresAt: idempotency.expiresAt,
        },
      });
      return this.toRecord(assessment);
    });
  }

  async getAssessment(
    actorUserId: string,
    assessmentId: string,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const assessment = await transaction.triageAssessment.findFirst({
        where: {
          id: assessmentId,
          OR: [
            { patientProfile: { userId: actorUserId } },
            {
              relationshipSource: {
                is: {
                  careRelationship: {
                    status: 'ACTIVE',
                    psychologistProfile: {
                      userId: actorUserId,
                      verificationStatus: VerificationStatus.VERIFIED,
                      user: { status: AccountStatus.ACTIVE },
                      licenses: { some: { status: VerificationStatus.VERIFIED } },
                    },
                  },
                },
              },
              consentWithdrawal: { is: null },
              erasureRequest: { is: null },
            },
          ],
        },
        include: assessmentInclude,
      });
      if (!assessment) throw AppError.notFound('TRIAGE_ASSESSMENT_NOT_FOUND');
      await this.writeAudit(transaction, audit, 'triage.assessment_viewed', assessment.id);
      return this.toRecord(assessment);
    });
  }

  async reviewAssessment(
    psychologistUserId: string,
    assessmentId: string,
    reviewedAt: Date,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const professional = await transaction.psychologistProfile.findFirst({
        where: {
          userId: psychologistUserId,
          verificationStatus: VerificationStatus.VERIFIED,
          user: { status: AccountStatus.ACTIVE },
          licenses: { some: { status: VerificationStatus.VERIFIED } },
          careRelationships: {
            some: {
              status: 'ACTIVE',
              source: { is: { triageAssessmentId: assessmentId } },
            },
          },
        },
        select: { id: true },
      });
      if (!professional) throw AppError.notFound('TRIAGE_ASSESSMENT_NOT_FOUND');

      const processingAllowed = await transaction.triageAssessment.findFirst({
        where: {
          id: assessmentId,
          consentWithdrawal: { is: null },
          erasureRequest: { is: null },
        },
        select: { id: true },
      });
      if (!processingAllowed) {
        throw AppError.conflict(
          'TRIAGE_PROCESSING_RESTRICTED',
          'La evaluación ya no admite procesamiento profesional.'
        );
      }

      const update = await transaction.triageAssessment.updateMany({
        where: {
          id: assessmentId,
          reviewedByPsychologistId: null,
          reviewedAt: null,
        },
        data: {
          reviewedByPsychologistId: professional.id,
          reviewedAt,
        },
      });
      const reviewed = await transaction.triageAssessment.findUnique({
        where: { id: assessmentId },
        include: assessmentInclude,
      });
      if (!reviewed) throw AppError.notFound('TRIAGE_ASSESSMENT_NOT_FOUND');
      if (reviewed.reviewedByPsychologistId !== professional.id) {
        throw AppError.conflict(
          'TRIAGE_ALREADY_REVIEWED',
          'La evaluación ya fue revisada por el profesional responsable.'
        );
      }
      if (update.count === 0) return this.toRecord(reviewed);

      await this.writeAudit(transaction, audit, 'triage.assessment_reviewed', reviewed.id, {
        evaluatorVersion: reviewed.evaluatorVersion,
      });
      return this.toRecord(reviewed);
    });
  }

  async withdrawConsent(
    patientUserId: string,
    assessmentId: string,
    withdrawnAt: Date,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOperation(
        transaction,
        patientUserId,
        'triage.consent.withdraw',
        assessmentId
      );
      const assessment = await transaction.triageAssessment.findFirst({
        where: { id: assessmentId, patientProfile: { userId: patientUserId } },
        include: {
          ...assessmentInclude,
          consentDecision: { select: { consentDocumentId: true } },
        },
      });
      if (!assessment) throw AppError.notFound('TRIAGE_ASSESSMENT_NOT_FOUND');
      if (assessment.consentWithdrawal) return this.toRecord(assessment);

      const withdrawalDecision = await transaction.patientConsent.create({
        data: {
          patientProfileId: assessment.patientProfileId,
          consentDocumentId: assessment.consentDecision.consentDocumentId,
          decision: ConsentDecision.WITHDRAWN,
          occurredAt: withdrawnAt,
          ipAddress: audit.ipAddress,
        },
        select: { id: true },
      });
      await transaction.triageConsentWithdrawal.create({
        data: {
          triageAssessmentId: assessment.id,
          patientProfileId: assessment.patientProfileId,
          withdrawalDecisionId: withdrawalDecision.id,
          withdrawnAt,
        },
      });
      await this.writeAudit(
        transaction,
        audit,
        'triage.consent_withdrawn',
        assessment.id,
        { effectiveAt: withdrawnAt.toISOString() }
      );
      return this.requireAssessment(transaction, assessment.id);
    });
  }

  async requestErasure(
    patientUserId: string,
    assessmentId: string,
    policyVersion: string,
    requestedAt: Date,
    dueAt: Date,
    audit: TriageAuditContext
  ): Promise<TriageAssessmentRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockOperation(
        transaction,
        patientUserId,
        'triage.erasure.request',
        assessmentId
      );
      const assessment = await transaction.triageAssessment.findFirst({
        where: { id: assessmentId, patientProfile: { userId: patientUserId } },
        include: assessmentInclude,
      });
      if (!assessment) throw AppError.notFound('TRIAGE_ASSESSMENT_NOT_FOUND');
      if (assessment.erasureRequest) return this.toRecord(assessment);

      await transaction.triageErasureRequest.create({
        data: {
          triageAssessmentId: assessment.id,
          patientProfileId: assessment.patientProfileId,
          status: 'BLOCKED',
          policyVersion,
          requestedAt,
          dueAt,
        },
      });
      await this.writeAudit(
        transaction,
        audit,
        'triage.erasure_requested',
        assessment.id,
        { policyVersion, dueAt: dueAt.toISOString() }
      );
      return this.requireAssessment(transaction, assessment.id);
    });
  }

  private toRecord(row: AssessmentRow): TriageAssessmentRecord {
    return {
      id: row.id,
      patientUserId: row.patientProfile.userId,
      primaryNeed: row.primaryNeed,
      provider: row.provider,
      model: row.model,
      evaluatorVersion: row.evaluatorVersion,
      providerOutcome: row.providerOutcome as TriageProviderOutcomeValue,
      countryCode: row.countryCode,
      orientationSummary: row.orientationSummary,
      riskLevel: row.riskLevel as TriageRiskLevelValue,
      recommendedModalities: row.recommendedModalities.map(
        ({ modality }) => modality as TriageModality
      ),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      reviewedBy: row.reviewedByPsychologist
        ? {
          userId: row.reviewedByPsychologist.user.id,
          displayName: row.reviewedByPsychologist.user.displayName,
        }
        : null,
      consentWithdrawnAt: row.consentWithdrawal?.withdrawnAt.toISOString() ?? null,
      erasureRequest: row.erasureRequest
        ? {
          id: row.erasureRequest.id,
          status: row.erasureRequest.status as TriageErasureRequestStatusValue,
          policyVersion: row.erasureRequest.policyVersion,
          requestedAt: row.erasureRequest.requestedAt.toISOString(),
          dueAt: row.erasureRequest.dueAt.toISOString(),
          resolvedAt: row.erasureRequest.resolvedAt?.toISOString() ?? null,
        }
        : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async requireAssessment(
    transaction: Prisma.TransactionClient,
    assessmentId: string
  ): Promise<TriageAssessmentRecord> {
    const assessment = await transaction.triageAssessment.findUnique({
      where: { id: assessmentId },
      include: assessmentInclude,
    });
    if (!assessment) throw AppError.notFound('TRIAGE_ASSESSMENT_NOT_FOUND');
    return this.toRecord(assessment);
  }

  private lockOperation(
    transaction: Prisma.TransactionClient,
    userId: string,
    operation: string,
    key: string
  ) {
    return transaction.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${`${userId}:${operation}:${key}`}, 0)
      )
    `);
  }

  private writeAudit(
    transaction: Prisma.TransactionClient,
    audit: TriageAuditContext,
    action: string,
    resourceId: string,
    metadata?: Prisma.InputJsonObject
  ) {
    return transaction.auditEvent.create({
      data: {
        actorUserId: audit.actorUserId,
        action,
        resourceType: 'triage_assessment',
        resourceId,
        requestId: audit.requestId,
        ipAddress: audit.ipAddress,
        metadata,
      },
    });
  }
}
