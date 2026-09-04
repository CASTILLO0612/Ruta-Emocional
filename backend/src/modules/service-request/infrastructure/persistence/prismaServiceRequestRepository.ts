import {
  AccountStatus,
  CareRelationshipStatus,
  Modality,
  OfferStatus,
  Prisma,
  PrismaClient,
  RequestStatus,
  VerificationStatus,
} from '../../../../generated/prisma/client';
import { AppError } from '../../../../shared/domain/appError';
import {
  IdempotentOperation,
  RequestAuditContext,
  ServiceRequestRepository,
} from '../../application/ports';
import {
  AcceptanceResult,
  EligibleServiceRequestView,
  encodeRequestCursor,
  PersistedServiceRequestInput,
  ProfessionalOfferSummary,
  RequestPageQuery,
  ServiceOfferView,
  ServiceRequestPage,
  ServiceRequestView,
} from '../../domain/serviceRequestTypes';

const CREATE_REQUEST_OPERATION = 'service_request.create';
const CREATE_OFFER_OPERATION = 'offer.create';
const ACCEPT_OFFER_OPERATION = 'offer.accept';
const OPEN_REQUEST_STATUSES: readonly RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.BIDDING,
];

const requestWithAcceptance = {
  offers: {
    where: { status: OfferStatus.ACCEPTED },
    take: 1,
    select: { id: true, psychologistProfileId: true, amount: true },
  },
} satisfies Prisma.ServiceRequestInclude;

const offerViewInclude = {
  request: { select: { currencyCode: true } },
  psychologistProfile: {
    select: {
      id: true,
      user: { select: { displayName: true, photoUrl: true } },
      specialties: {
        where: { isPrimary: true },
        take: 1,
        select: { specialty: { select: { name: true } } },
      },
    },
  },
} satisfies Prisma.OfferInclude;

type RequestRow = Prisma.ServiceRequestGetPayload<{ include: typeof requestWithAcceptance }>;
type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerViewInclude }>;
type DatabaseClient = PrismaClient | Prisma.TransactionClient;

interface IdentifierRow {
  readonly id: string;
}

interface RatingRow {
  readonly psychologistProfileId: string;
  readonly averageRating: Prisma.Decimal | null;
  readonly totalReviews: bigint;
}

export interface SerializableRetryPolicy {
  readonly maximumRetries: number;
  readonly baseDelayMs: number;
}

function requestView(row: RequestRow): ServiceRequestView {
  const accepted = row.offers[0];
  return {
    id: row.id,
    modality: row.modality,
    primaryNeed: row.primaryNeed,
    description: row.description,
    proposedBudget: {
      amount: row.proposedBudget.toFixed(2),
      currency: row.currencyCode,
    },
    status: row.status,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    acceptedOffer: accepted ? {
      id: accepted.id,
      psychologistProfileId: accepted.psychologistProfileId,
      price: { amount: accepted.amount.toFixed(2), currency: row.currencyCode },
    } : null,
  };
}

function eligibleRequestView(row: RequestRow): EligibleServiceRequestView {
  if (row.status !== RequestStatus.PENDING && row.status !== RequestStatus.BIDDING) {
    throw new Error('Eligible request projection received a closed request');
  }
  return {
    id: row.id,
    modality: row.modality,
    primaryNeed: row.primaryNeed,
    description: row.description,
    proposedBudget: {
      amount: row.proposedBudget.toFixed(2),
      currency: row.currencyCode,
    },
    status: row.status,
    scheduledFor: row.scheduledFor?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function isSerializationConflict(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2034') return true;
  if (error.code !== 'P2010' || typeof error.meta !== 'object' || error.meta === null) {
    return false;
  }
  const metadata = error.meta as Record<string, unknown>;
  return metadata.code === '40001'
    || (typeof metadata.database_error === 'string' && metadata.database_error.includes('40001'));
}

export class PrismaServiceRequestRepository implements ServiceRequestRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly retryPolicy: SerializableRetryPolicy
  ) {}

  async expireOpenRequests(now: Date, batchSize: number): Promise<number> {
    return this.prisma.$transaction(async (transaction) => {
      const expired = await transaction.$queryRaw<IdentifierRow[]>(Prisma.sql`
        SELECT "id"
          FROM "service_requests"
         WHERE "status" IN ('PENDING', 'BIDDING')
           AND "expires_at" <= ${now}
         ORDER BY "expires_at", "id"
         LIMIT ${batchSize}
         FOR UPDATE SKIP LOCKED
      `);
      const ids = expired.map(({ id }) => id);
      if (!ids.length) return 0;

      await transaction.offer.updateMany({
        where: { requestId: { in: ids }, status: OfferStatus.PENDING },
        data: { status: OfferStatus.REJECTED },
      });
      await transaction.serviceRequest.updateMany({
        where: { id: { in: ids }, status: { in: [...OPEN_REQUEST_STATUSES] } },
        data: { status: RequestStatus.EXPIRED },
      });
      await transaction.auditEvent.createMany({
        data: ids.map((id) => ({
          action: 'service_request.expired',
          resourceType: 'service_request',
          resourceId: id,
          metadata: { source: 'expiration_policy' },
        })),
      });
      await transaction.outboxEvent.createMany({
        data: ids.map((id) => ({
          aggregateType: 'service_request',
          aggregateId: id,
          eventType: 'service_request.expired',
          payload: { requestId: id },
        })),
      });
      return ids.length;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async createRequest(
    userId: string,
    input: PersistedServiceRequestInput,
    idempotency: IdempotentOperation,
    maximumOpenImmediateRequests: number,
    audit: RequestAuditContext
  ): Promise<ServiceRequestView> {
    return this.withSerializableRetry(async (transaction) => {
      await this.lockOperation(transaction, userId, CREATE_REQUEST_OPERATION, idempotency.key);
      const replay = await this.findIdempotentResource(
        transaction,
        userId,
        CREATE_REQUEST_OPERATION,
        idempotency
      );
      if (replay) {
        const existing = await transaction.serviceRequest.findUnique({
          where: { id: replay },
          include: requestWithAcceptance,
        });
        if (!existing) throw AppError.conflict('IDEMPOTENCY_RESOURCE_MISSING', 'El resultado previo ya no existe.');
        return requestView(existing);
      }

      const patient = await transaction.patientProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!patient) throw AppError.forbidden('PATIENT_PROFILE_REQUIRED');

      await transaction.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${`patient-open-request:${patient.id}`}, 0))
      `);
      if (!input.scheduledFor) {
        const openImmediate = await transaction.serviceRequest.count({
          where: {
            patientProfileId: patient.id,
            scheduledFor: null,
            status: { in: [...OPEN_REQUEST_STATUSES] },
          },
        });
        if (openImmediate >= maximumOpenImmediateRequests) {
          throw AppError.conflict(
            'OPEN_IMMEDIATE_REQUEST_LIMIT',
            'Ya alcanzaste el límite de solicitudes inmediatas abiertas.'
          );
        }
      }

      const created = await transaction.serviceRequest.create({
        data: {
          patientProfileId: patient.id,
          modality: input.modality,
          primaryNeed: input.primaryNeed,
          description: input.description,
          proposedBudget: new Prisma.Decimal(input.proposedBudget.amount),
          currencyCode: input.proposedBudget.currency,
          scheduledFor: input.scheduledFor,
          expiresAt: input.expiresAt,
          locationExpiresAt: input.locationExpiresAt,
        },
        include: requestWithAcceptance,
      });

      if (input.location) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE "service_requests"
             SET "location" = ST_SetSRID(
               ST_MakePoint(${input.location.longitude}, ${input.location.latitude}),
               4326
             )::geography
           WHERE "id" = ${created.id}::uuid
        `);
      }

      await transaction.idempotencyRecord.create({
        data: {
          actorUserId: userId,
          operation: CREATE_REQUEST_OPERATION,
          idempotencyKey: idempotency.key,
          requestHash: idempotency.requestHash,
          resourceId: created.id,
          expiresAt: idempotency.expiresAt,
        },
      });
      await this.writeAudit(transaction, audit, 'service_request.created', 'service_request', created.id, {
        modality: created.modality,
        scheduled: Boolean(created.scheduledFor),
      });
      await transaction.outboxEvent.create({
        data: {
          aggregateType: 'service_request',
          aggregateId: created.id,
          eventType: 'service_request.created',
          payload: { requestId: created.id, modality: created.modality },
        },
      });
      return requestView(created);
    });
  }

  async listOwnRequests(
    userId: string,
    query: RequestPageQuery
  ): Promise<ServiceRequestPage<ServiceRequestView>> {
    const rows = await this.prisma.serviceRequest.findMany({
      where: {
        patientProfile: { userId },
        ...(query.status ? { status: query.status } : {}),
        ...(query.cursor ? {
          OR: [
            { createdAt: { lt: query.cursor.createdAt } },
            { createdAt: query.cursor.createdAt, id: { lt: query.cursor.id } },
          ],
        } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      include: requestWithAcceptance,
    });
    return this.page(rows, query.limit, requestView);
  }

  async listEligibleRequests(
    userId: string,
    query: RequestPageQuery,
    now: Date
  ): Promise<ServiceRequestPage<EligibleServiceRequestView>> {
    const cursor = query.cursor
      ? Prisma.sql`AND (request."created_at", request."id") < (${query.cursor.createdAt}, ${query.cursor.id}::uuid)`
      : Prisma.empty;
    const status = query.status
      ? Prisma.sql`AND request."status" = ${query.status}::"request_status"`
      : Prisma.empty;
    const ids = await this.prisma.$queryRaw<IdentifierRow[]>(Prisma.sql`
      SELECT request."id"
        FROM "service_requests" request
        JOIN "patient_profiles" patient ON patient."id" = request."patient_profile_id"
       WHERE request."status" IN ('PENDING', 'BIDDING')
         AND request."expires_at" > ${now}
         AND patient."user_id" <> ${userId}::uuid
         AND NOT EXISTS (
           SELECT 1
             FROM "offers" own_offer
             JOIN "psychologist_profiles" own_profile
               ON own_profile."id" = own_offer."psychologist_profile_id"
            WHERE own_offer."request_id" = request."id"
              AND own_profile."user_id" = ${userId}::uuid
         )
         ${status}
         ${cursor}
         AND EXISTS (
           SELECT 1
             FROM "psychologist_profiles" profile
             JOIN "users" account ON account."id" = profile."user_id"
            WHERE profile."user_id" = ${userId}::uuid
              AND profile."verification_status" = 'VERIFIED'
              AND account."status" = 'ACTIVE'
              AND EXISTS (
                SELECT 1 FROM "professional_licenses" license
                 WHERE license."psychologist_profile_id" = profile."id"
                   AND license."status" = 'VERIFIED'
              )
              AND EXISTS (
                SELECT 1 FROM "psychologist_modalities" modality
                 WHERE modality."psychologist_profile_id" = profile."id"
                   AND modality."modality" = request."modality"
                   AND modality."is_enabled" = true
                   AND modality."price_per_hour" > 0
              )
         )
       ORDER BY request."created_at" DESC, request."id" DESC
       LIMIT ${query.limit + 1}
    `);
    const rows = await this.hydrateRequests(ids.map(({ id }) => id));
    return this.page(rows, query.limit, eligibleRequestView);
  }

  async findRequestForActor(userId: string, requestId: string): Promise<ServiceRequestView | null> {
    const visible = await this.prisma.$queryRaw<IdentifierRow[]>(Prisma.sql`
      SELECT request."id"
        FROM "service_requests" request
        JOIN "patient_profiles" patient ON patient."id" = request."patient_profile_id"
       WHERE request."id" = ${requestId}::uuid
         AND (
           patient."user_id" = ${userId}::uuid
           OR EXISTS (
             SELECT 1
               FROM "offers" offer
               JOIN "psychologist_profiles" profile
                 ON profile."id" = offer."psychologist_profile_id"
              WHERE offer."request_id" = request."id"
                AND profile."user_id" = ${userId}::uuid
           )
           OR (
             request."status" IN ('PENDING', 'BIDDING')
             AND request."expires_at" > CURRENT_TIMESTAMP
             AND EXISTS (
               SELECT 1
                 FROM "psychologist_profiles" profile
                 JOIN "users" account ON account."id" = profile."user_id"
                WHERE profile."user_id" = ${userId}::uuid
                  AND profile."verification_status" = 'VERIFIED'
                  AND account."status" = 'ACTIVE'
                  AND EXISTS (
                    SELECT 1 FROM "professional_licenses" license
                     WHERE license."psychologist_profile_id" = profile."id"
                       AND license."status" = 'VERIFIED'
                  )
                  AND EXISTS (
                    SELECT 1 FROM "psychologist_modalities" modality
                    WHERE modality."psychologist_profile_id" = profile."id"
                       AND modality."modality" = request."modality"
                       AND modality."is_enabled" = true
                       AND modality."price_per_hour" > 0
                  )
             )
           )
         )
       LIMIT 1
    `);
    if (!visible.length) return null;
    const row = await this.prisma.serviceRequest.findUnique({
      where: { id: requestId },
      include: requestWithAcceptance,
    });
    return row ? requestView(row) : null;
  }

  async cancelOwnRequest(
    userId: string,
    requestId: string,
    audit: RequestAuditContext
  ): Promise<ServiceRequestView> {
    return this.withSerializableRetry(async (transaction) => {
      await this.lockRequest(transaction, requestId);
      const request = await transaction.serviceRequest.findFirst({
        where: { id: requestId, patientProfile: { userId } },
        include: requestWithAcceptance,
      });
      if (!request) throw AppError.notFound('SERVICE_REQUEST_NOT_FOUND');
      if (request.status === RequestStatus.CANCELLED) return requestView(request);
      if (!OPEN_REQUEST_STATUSES.includes(request.status)) {
        throw AppError.conflict('REQUEST_CANNOT_BE_CANCELLED', 'La solicitud ya no puede cancelarse.');
      }

      await transaction.offer.updateMany({
        where: { requestId, status: OfferStatus.PENDING },
        data: { status: OfferStatus.REJECTED },
      });
      const updated = await transaction.serviceRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.CANCELLED },
        include: requestWithAcceptance,
      });
      await this.writeAudit(transaction, audit, 'service_request.cancelled', 'service_request', requestId);
      await transaction.outboxEvent.create({
        data: {
          aggregateType: 'service_request',
          aggregateId: requestId,
          eventType: 'service_request.cancelled',
          payload: { requestId },
        },
      });
      return requestView(updated);
    });
  }

  async createOwnOffer(
    userId: string,
    requestId: string,
    amount: string,
    message: string | undefined,
    now: Date,
    idempotency: IdempotentOperation,
    audit: RequestAuditContext
  ): Promise<ServiceOfferView> {
    try {
      return await this.withSerializableRetry(async (transaction) => {
        await this.lockOperation(transaction, userId, CREATE_OFFER_OPERATION, idempotency.key);
        const replay = await this.findIdempotentResource(
          transaction,
          userId,
          CREATE_OFFER_OPERATION,
          idempotency
        );
        if (replay) {
          const existing = await transaction.offer.findUnique({
            where: { id: replay },
            include: offerViewInclude,
          });
          if (!existing) {
            throw AppError.conflict(
              'IDEMPOTENCY_RESOURCE_MISSING',
              'El resultado previo ya no existe.'
            );
          }
          return (await this.offerViews(transaction, [existing]))[0];
        }

        await this.lockRequest(transaction, requestId);
        const request = await transaction.serviceRequest.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            modality: true,
            status: true,
            expiresAt: true,
            patientProfile: { select: { userId: true } },
          },
        });
        if (!request) throw AppError.notFound('SERVICE_REQUEST_NOT_FOUND');
        if (!OPEN_REQUEST_STATUSES.includes(request.status) || request.expiresAt <= now) {
          throw AppError.conflict('REQUEST_NOT_OPEN', 'La solicitud ya no admite ofertas.');
        }
        if (request.patientProfile.userId === userId) {
          throw AppError.forbidden('OWN_REQUEST_OFFER_FORBIDDEN');
        }

        const professional = await transaction.psychologistProfile.findFirst({
          where: {
            userId,
            verificationStatus: VerificationStatus.VERIFIED,
            user: { status: AccountStatus.ACTIVE },
            licenses: { some: { status: VerificationStatus.VERIFIED } },
            modalities: {
              some: { modality: request.modality, isEnabled: true, pricePerHour: { gt: 0 } },
            },
          },
          select: { id: true },
        });
        if (!professional) throw AppError.forbidden('PROFESSIONAL_NOT_ELIGIBLE');

        const offer = await transaction.offer.create({
          data: {
            requestId,
            psychologistProfileId: professional.id,
            amount: new Prisma.Decimal(amount),
            message,
          },
          include: offerViewInclude,
        });
        if (request.status === RequestStatus.PENDING) {
          await transaction.serviceRequest.update({
            where: { id: requestId },
            data: { status: RequestStatus.BIDDING },
          });
        }
        await this.writeAudit(transaction, audit, 'offer.created', 'offer', offer.id, { requestId });
        await transaction.idempotencyRecord.create({
          data: {
            actorUserId: userId,
            operation: CREATE_OFFER_OPERATION,
            idempotencyKey: idempotency.key,
            requestHash: idempotency.requestHash,
            resourceId: offer.id,
            expiresAt: idempotency.expiresAt,
          },
        });
        await transaction.outboxEvent.create({
          data: {
            aggregateType: 'service_request',
            aggregateId: requestId,
            eventType: 'offer.created',
            payload: { requestId, offerId: offer.id },
          },
        });
        return (await this.offerViews(transaction, [offer]))[0];
      });
    } catch (error) {
      if (isUniqueConstraint(error)) {
        throw AppError.conflict('OFFER_ALREADY_EXISTS', 'Ya existe una oferta propia para esta solicitud.');
      }
      throw error;
    }
  }

  async listRequestOffers(userId: string, requestId: string): Promise<readonly ServiceOfferView[]> {
    const request = await this.prisma.serviceRequest.findFirst({
      where: { id: requestId, patientProfile: { userId } },
      select: { id: true },
    });
    if (!request) throw AppError.notFound('SERVICE_REQUEST_NOT_FOUND');
    const offers = await this.prisma.offer.findMany({
      where: { requestId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: offerViewInclude,
    });
    return this.offerViews(this.prisma, offers);
  }

  async withdrawOwnOffer(
    userId: string,
    requestId: string,
    offerId: string,
    audit: RequestAuditContext
  ): Promise<ServiceOfferView> {
    return this.withSerializableRetry(async (transaction) => {
      await this.lockRequest(transaction, requestId);
      const offer = await transaction.offer.findFirst({
        where: {
          id: offerId,
          requestId,
          psychologistProfile: { userId },
        },
        include: offerViewInclude,
      });
      if (!offer) throw AppError.notFound('OFFER_NOT_FOUND');
      if (offer.status === OfferStatus.WITHDRAWN) {
        return (await this.offerViews(transaction, [offer]))[0];
      }
      if (offer.status !== OfferStatus.PENDING) {
        throw AppError.conflict('OFFER_CANNOT_BE_WITHDRAWN', 'La oferta ya no puede retirarse.');
      }

      const updated = await transaction.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.WITHDRAWN },
        include: offerViewInclude,
      });
      const remaining = await transaction.offer.count({
        where: { requestId, status: OfferStatus.PENDING },
      });
      if (remaining === 0) {
        await transaction.serviceRequest.updateMany({
          where: { id: requestId, status: RequestStatus.BIDDING },
          data: { status: RequestStatus.PENDING },
        });
      }
      await this.writeAudit(transaction, audit, 'offer.withdrawn', 'offer', offerId, { requestId });
      await transaction.outboxEvent.create({
        data: {
          aggregateType: 'service_request',
          aggregateId: requestId,
          eventType: 'offer.withdrawn',
          payload: { requestId, offerId },
        },
      });
      return (await this.offerViews(transaction, [updated]))[0];
    });
  }

  async acceptOffer(
    userId: string,
    requestId: string,
    offerId: string,
    idempotency: IdempotentOperation,
    audit: RequestAuditContext
  ): Promise<AcceptanceResult> {
    return this.withSerializableRetry(async (transaction) => {
      await this.lockOperation(transaction, userId, ACCEPT_OFFER_OPERATION, idempotency.key);
      const replay = await this.findIdempotentResource(
        transaction,
        userId,
        ACCEPT_OFFER_OPERATION,
        idempotency
      );
      if (replay) return this.acceptanceResult(transaction, replay, true);

      await this.lockRequest(transaction, requestId);
      const request = await transaction.serviceRequest.findFirst({
        where: { id: requestId, patientProfile: { userId } },
        select: { id: true, status: true, patientProfileId: true },
      });
      if (!request) throw AppError.notFound('SERVICE_REQUEST_NOT_FOUND');
      if (request.status === RequestStatus.ACCEPTED) {
        throw AppError.conflict('REQUEST_ALREADY_ACCEPTED', 'La solicitud ya tiene una oferta aceptada.');
      }
      if (request.status !== RequestStatus.BIDDING) {
        throw AppError.conflict('REQUEST_NOT_ACCEPTABLE', 'La solicitud no está en estado de aceptación.');
      }

      const offer = await transaction.offer.findFirst({
        where: { id: offerId, requestId, status: OfferStatus.PENDING },
        select: {
          id: true,
          psychologistProfileId: true,
          psychologistProfile: { select: { userId: true } },
        },
      });
      if (!offer) throw AppError.notFound('OFFER_NOT_FOUND');

      const currentTriage = await transaction.requestTriageAssessment.findFirst({
        where: { serviceRequestId: requestId },
        orderBy: [
          { triageAssessment: { createdAt: 'desc' } },
          { triageAssessmentId: 'desc' },
        ],
        select: {
          triageAssessmentId: true,
          triageAssessment: {
            select: {
              riskLevel: true,
              consentWithdrawal: { select: { id: true } },
              erasureRequest: { select: { status: true } },
            },
          },
        },
      });
      if (
        currentTriage?.triageAssessment.consentWithdrawal
        || currentTriage?.triageAssessment.erasureRequest
      ) {
        throw AppError.conflict(
          'TRIAGE_PROCESSING_RESTRICTED',
          'La evaluación vinculada ya no autoriza continuar el flujo comercial.'
        );
      }
      if (currentTriage?.triageAssessment.riskLevel === 'CRITICAL') {
        throw AppError.conflict(
          'CRITICAL_TRIAGE_INTERRUPTS_COMMERCIAL_FLOW',
          'La orientación detectó una necesidad de ayuda inmediata. Usa los recursos de seguridad antes de continuar con ofertas.'
        );
      }

      await transaction.offer.update({
        where: { id: offerId },
        data: { status: OfferStatus.ACCEPTED },
      });
      await transaction.offer.updateMany({
        where: { requestId, id: { not: offerId }, status: OfferStatus.PENDING },
        data: { status: OfferStatus.REJECTED },
      });
      await transaction.serviceRequest.update({
        where: { id: requestId },
        data: { status: RequestStatus.ACCEPTED },
      });
      const relationship = await this.findOrCreateActiveRelationship(transaction, {
        patientProfileId: request.patientProfileId,
        psychologistProfileId: offer.psychologistProfileId,
        acceptedOfferId: offerId,
        triageAssessmentId: currentTriage?.triageAssessmentId,
      });
      const conversation = await this.findOrCreateRelationshipConversation(transaction, {
        careRelationshipId: relationship.id,
        patientUserId: userId,
        psychologistUserId: offer.psychologistProfile.userId,
      });
      await transaction.idempotencyRecord.create({
        data: {
          actorUserId: userId,
          operation: ACCEPT_OFFER_OPERATION,
          idempotencyKey: idempotency.key,
          requestHash: idempotency.requestHash,
          resourceId: offerId,
          expiresAt: idempotency.expiresAt,
        },
      });
      await this.writeAudit(transaction, audit, 'offer.accepted', 'offer', offerId, {
        requestId,
        careRelationshipId: relationship.id,
        conversationId: conversation.id,
        relationshipReused: relationship.reused,
      });
      await transaction.outboxEvent.create({
        data: {
          aggregateType: 'service_request',
          aggregateId: requestId,
          eventType: 'offer.accepted',
          payload: {
            requestId,
            offerId,
            psychologistProfileId: offer.psychologistProfileId,
            careRelationshipId: relationship.id,
            conversationId: conversation.id,
            relationshipReused: relationship.reused,
          },
        },
      });
      return this.acceptanceResult(transaction, offerId, false);
    });
  }

  private async hydrateRequests(ids: readonly string[]): Promise<RequestRow[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.serviceRequest.findMany({
      where: { id: { in: [...ids] } },
      include: requestWithAcceptance,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
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
        if (!isSerializationConflict(error) || attempt >= this.retryPolicy.maximumRetries) {
          throw error;
        }
        const exponentialDelay = this.retryPolicy.baseDelayMs * (2 ** attempt);
        const jitter = Math.floor(Math.random() * this.retryPolicy.baseDelayMs);
        await new Promise<void>((resolve) => setTimeout(resolve, exponentialDelay + jitter));
      }
    }
  }

  private page<T extends { readonly id: string; readonly createdAt: Date }, V>(
    rows: readonly T[],
    limit: number,
    mapper: (row: T) => V
  ): ServiceRequestPage<V> {
    const hasNext = rows.length > limit;
    const pageRows = hasNext ? rows.slice(0, limit) : rows;
    const last = pageRows.at(-1);
    return {
      items: pageRows.map(mapper),
      nextCursor: hasNext && last
        ? encodeRequestCursor({ createdAt: last.createdAt, id: last.id })
        : null,
    };
  }

  private async offerViews(client: DatabaseClient, rows: readonly OfferRow[]): Promise<ServiceOfferView[]> {
    const profileIds = [...new Set(rows.map(({ psychologistProfileId }) => psychologistProfileId))];
    const ratings = profileIds.length
      ? await client.$queryRaw<RatingRow[]>(Prisma.sql`
          SELECT appointment."psychologist_profile_id" AS "psychologistProfileId",
                 avg(review."rating")::numeric(4,2) AS "averageRating",
                 count(review."id")::bigint AS "totalReviews"
            FROM "appointments" appointment
            JOIN "reviews" review ON review."appointment_id" = appointment."id"
           WHERE appointment."psychologist_profile_id" IN (
             ${Prisma.join(profileIds.map((id) => Prisma.sql`${id}::uuid`))}
           )
           GROUP BY appointment."psychologist_profile_id"
        `)
      : [];
    const ratingByProfile = new Map(ratings.map((rating) => [rating.psychologistProfileId, rating]));

    return rows.map((row) => {
      const rating = ratingByProfile.get(row.psychologistProfileId);
      const professional: ProfessionalOfferSummary = {
        profileId: row.psychologistProfile.id,
        displayName: row.psychologistProfile.user.displayName,
        photoUrl: row.psychologistProfile.user.photoUrl,
        primarySpecialty: row.psychologistProfile.specialties[0]?.specialty.name ?? null,
        rating: rating?.averageRating ? Number(rating.averageRating) : 0,
        totalReviews: Number(rating?.totalReviews ?? 0n),
      };
      return {
        id: row.id,
        requestId: row.requestId,
        professional,
        price: { amount: row.amount.toFixed(2), currency: row.request.currencyCode },
        message: row.message,
        status: row.status,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
  }

  private async acceptanceResult(
    transaction: Prisma.TransactionClient,
    offerId: string,
    replayed: boolean
  ): Promise<AcceptanceResult> {
    const offer = await transaction.offer.findUnique({
      where: { id: offerId },
      include: offerViewInclude,
    });
    if (!offer || offer.status !== OfferStatus.ACCEPTED) {
      throw AppError.conflict('IDEMPOTENCY_RESOURCE_MISSING', 'El resultado previo ya no está disponible.');
    }
    const request = await transaction.serviceRequest.findUnique({
      where: { id: offer.requestId },
      include: requestWithAcceptance,
    });
    if (!request) {
      throw AppError.conflict('ACCEPTANCE_RESULT_INCOMPLETE', 'La aceptación no está completa.');
    }
    const source = await transaction.careRelationshipSource.findUnique({
      where: { acceptedOfferId: offer.id },
      select: { careRelationshipId: true },
    });
    const recoveredRelationship = source
      ? null
      : await transaction.careRelationship.findFirst({
          where: {
            patientProfileId: request.patientProfileId,
            psychologistProfileId: offer.psychologistProfileId,
            status: CareRelationshipStatus.ACTIVE,
          },
          orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
          select: { id: true },
        });
    const careRelationshipId = source?.careRelationshipId ?? recoveredRelationship?.id;
    const conversation = careRelationshipId
      ? await transaction.conversation.findUnique({
          where: { careRelationshipId },
          select: { id: true },
        })
      : null;
    if (!careRelationshipId || !conversation) {
      throw AppError.conflict('ACCEPTANCE_RESULT_INCOMPLETE', 'La aceptación no está completa.');
    }
    return {
      request: requestView(request),
      acceptedOffer: (await this.offerViews(transaction, [offer]))[0],
      careRelationshipId,
      conversationId: conversation.id,
      replayed,
    };
  }

  private async findOrCreateActiveRelationship(
    transaction: Prisma.TransactionClient,
    input: {
      readonly patientProfileId: string;
      readonly psychologistProfileId: string;
      readonly acceptedOfferId: string;
      readonly triageAssessmentId?: string;
    }
  ): Promise<{ readonly id: string; readonly reused: boolean }> {
    await transaction.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(
          ${`care-relationship:${input.patientProfileId}:${input.psychologistProfileId}`},
          0
        )
      )
    `);

    const active = await transaction.careRelationship.findFirst({
      where: {
        patientProfileId: input.patientProfileId,
        psychologistProfileId: input.psychologistProfileId,
        status: CareRelationshipStatus.ACTIVE,
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      select: { id: true },
    });
    if (active) return { id: active.id, reused: true };

    const created = await transaction.careRelationship.create({
      data: {
        patientProfileId: input.patientProfileId,
        psychologistProfileId: input.psychologistProfileId,
        source: {
          create: {
            acceptedOfferId: input.acceptedOfferId,
            triageAssessmentId: input.triageAssessmentId,
          },
        },
      },
      select: { id: true },
    });
    return { id: created.id, reused: false };
  }

  private async findOrCreateRelationshipConversation(
    transaction: Prisma.TransactionClient,
    input: {
      readonly careRelationshipId: string;
      readonly patientUserId: string;
      readonly psychologistUserId: string;
    }
  ): Promise<{ readonly id: string }> {
    const existing = await transaction.conversation.findUnique({
      where: { careRelationshipId: input.careRelationshipId },
      select: { id: true },
    });
    if (existing) return existing;

    return transaction.conversation.create({
      data: {
        careRelationshipId: input.careRelationshipId,
        participants: {
          create: [
            { userId: input.patientUserId },
            { userId: input.psychologistUserId },
          ],
        },
      },
      select: { id: true },
    });
  }

  private async lockRequest(transaction: Prisma.TransactionClient, requestId: string): Promise<void> {
    await transaction.$queryRaw(Prisma.sql`
      SELECT "id" FROM "service_requests" WHERE "id" = ${requestId}::uuid FOR UPDATE
    `);
  }

  private async lockOperation(
    transaction: Prisma.TransactionClient,
    userId: string,
    operation: string,
    key: string
  ): Promise<void> {
    await transaction.$executeRaw(Prisma.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${operation}:${key}`}, 0))
    `);
  }

  private async findIdempotentResource(
    transaction: Prisma.TransactionClient,
    userId: string,
    operation: string,
    idempotency: IdempotentOperation
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
        'La clave de idempotencia ya fue usada con otro contenido.'
      );
    }
    return existing.resourceId;
  }

  private writeAudit(
    transaction: Prisma.TransactionClient,
    audit: RequestAuditContext,
    action: string,
    resourceType: string,
    resourceId: string,
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
