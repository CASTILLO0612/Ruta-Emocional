import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '../../../../generated/prisma/client';
import { AppError } from '../../../../shared/domain/appError';
import type { CallAuditContext, CallSessionRepository } from '../../application/ports';
import type { CallMediaType, CallSessionRecord, CallSessionStatus } from '../../domain/callTypes';

interface CallRow {
  readonly id: string;
  readonly conversationId: string;
  readonly initiatorUserId: string;
  readonly mediaType: CallMediaType;
  readonly status: CallSessionStatus;
  readonly roomName: string;
  readonly acceptedAt: Date | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly initiatorName: string;
  readonly initiatorPhotoUrl: string | null;
  readonly counterpartUserId: string;
  readonly counterpartName: string;
  readonly counterpartPhotoUrl: string | null;
}

interface ConversationRow {
  readonly relationshipStatus: string;
  readonly modality: string;
  readonly activeParticipantCount: number;
}

async function selectCall(
  client: PrismaClient | Prisma.TransactionClient,
  actorUserId: string,
  callId: string
): Promise<CallRow | null> {
  const rows = await client.$queryRaw<CallRow[]>(Prisma.sql`
    SELECT
      call."id"::text AS "id",
      call."conversation_id"::text AS "conversationId",
      call."initiator_user_id"::text AS "initiatorUserId",
      call."media_type"::text AS "mediaType",
      call."status"::text AS "status",
      call."room_name" AS "roomName",
      call."accepted_at" AS "acceptedAt",
      call."created_at" AS "createdAt",
      call."expires_at" AS "expiresAt",
      initiator."display_name" AS "initiatorName",
      initiator."photo_url" AS "initiatorPhotoUrl",
      counterpart."user_id"::text AS "counterpartUserId",
      counterpart_user."display_name" AS "counterpartName",
      counterpart_user."photo_url" AS "counterpartPhotoUrl"
    FROM "call_sessions" call
    JOIN "users" initiator ON initiator."id" = call."initiator_user_id"
    JOIN LATERAL (
      SELECT participant."user_id"
        FROM "conversation_participants" participant
       WHERE participant."conversation_id" = call."conversation_id"
         AND participant."left_at" IS NULL
         AND participant."user_id" <> ${actorUserId}::uuid
       LIMIT 1
    ) counterpart ON TRUE
    JOIN "users" counterpart_user ON counterpart_user."id" = counterpart."user_id"
    WHERE call."id" = ${callId}::uuid
      AND EXISTS (
        SELECT 1 FROM "conversation_participants" mine
         WHERE mine."conversation_id" = call."conversation_id"
           AND mine."user_id" = ${actorUserId}::uuid
           AND mine."left_at" IS NULL
      )
    LIMIT 1
  `);
  return rows[0] ?? null;
}

function toRecord(row: CallRow): CallSessionRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    initiatorUserId: row.initiatorUserId,
    mediaType: row.mediaType,
    status: row.status,
    initiator: {
      userId: row.initiatorUserId,
      displayName: row.initiatorName,
      photoUrl: row.initiatorPhotoUrl,
    },
    counterpart: {
      userId: row.counterpartUserId,
      displayName: row.counterpartName,
      photoUrl: row.counterpartPhotoUrl,
    },
    roomName: row.roomName,
    createdAt: row.createdAt.toISOString(),
    acceptedAt: row.acceptedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export class PrismaCallSessionRepository implements CallSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async start(
    actorUserId: string,
    conversationId: string,
    mediaType: CallMediaType,
    ringingTimeoutSeconds: number,
    audit: CallAuditContext
  ): Promise<CallSessionRecord> {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const conversations = await transaction.$queryRaw<ConversationRow[]>(Prisma.sql`
          SELECT
            relationship."status"::text AS "relationshipStatus",
            request."modality"::text AS "modality",
            (
              SELECT COUNT(*)::int
                FROM "conversation_participants" active_participant
               WHERE active_participant."conversation_id" = conversation."id"
                 AND active_participant."left_at" IS NULL
            ) AS "activeParticipantCount"
          FROM "conversations" conversation
          JOIN "care_relationships" relationship
            ON relationship."id" = conversation."care_relationship_id"
          JOIN "care_relationship_sources" source
            ON source."care_relationship_id" = relationship."id"
          JOIN "offers" accepted_offer ON accepted_offer."id" = source."accepted_offer_id"
          JOIN "service_requests" request ON request."id" = accepted_offer."request_id"
          WHERE conversation."id" = ${conversationId}::uuid
            AND EXISTS (
              SELECT 1 FROM "conversation_participants" mine
               WHERE mine."conversation_id" = conversation."id"
                 AND mine."user_id" = ${actorUserId}::uuid
                 AND mine."left_at" IS NULL
            )
          FOR UPDATE OF relationship
        `);
        const conversation = conversations[0];
        if (!conversation) throw AppError.notFound('CONVERSATION_NOT_FOUND');
        if (conversation.relationshipStatus !== 'ACTIVE') {
          throw AppError.forbidden('CARE_RELATIONSHIP_INACTIVE');
        }
        if (conversation.modality !== 'CALL') {
          throw AppError.forbidden('CALL_MODALITY_NOT_ALLOWED');
        }
        if (conversation.activeParticipantCount !== 2) {
          throw AppError.conflict('CALL_PARTICIPANTS_UNAVAILABLE', 'No se pudo iniciar la llamada con esta conversación.');
        }

        const activeCalls = await transaction.$queryRaw<Array<{ id: string; initiatorUserId: string; expiresAt: Date }>>(Prisma.sql`
          SELECT "id"::text AS "id", "initiator_user_id"::text AS "initiatorUserId", "expires_at" AS "expiresAt"
            FROM "call_sessions"
           WHERE "conversation_id" = ${conversationId}::uuid
             AND "status" IN ('RINGING', 'ACTIVE')
           FOR UPDATE
        `);
        const now = new Date();
        const activeCall = activeCalls[0];
        if (activeCall && activeCall.expiresAt > now) {
          if (activeCall.initiatorUserId === actorUserId) {
            const existing = await selectCall(transaction, actorUserId, activeCall.id);
            if (existing) return toRecord(existing);
          }
          throw AppError.conflict('CALL_ALREADY_ACTIVE', 'Ya hay una llamada abierta para esta conversación.');
        }
        if (activeCall) {
          await transaction.$executeRaw(Prisma.sql`
            UPDATE "call_sessions"
               SET "status" = 'MISSED', "ended_at" = ${now}, "updated_at" = ${now}
             WHERE "id" = ${activeCall.id}::uuid
          `);
        }

        const callId = randomUUID();
        const roomName = randomUUID();
        const expiresAt = new Date(now.getTime() + ringingTimeoutSeconds * 1000);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "call_sessions" (
            "id", "conversation_id", "initiator_user_id", "media_type", "room_name", "expires_at"
          ) VALUES (
            ${callId}::uuid, ${conversationId}::uuid, ${actorUserId}::uuid,
            ${mediaType}::call_media_type, ${roomName}, ${expiresAt}
          )
        `);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "audit_events" (
            "actor_user_id", "action", "resource_type", "resource_id", "request_id", "ip_address", "metadata"
          ) VALUES (
            ${actorUserId}::uuid, 'call.started', 'call_session', ${callId}::uuid,
            ${audit.requestId ?? null}, ${audit.ipAddress ?? null}::inet,
            ${JSON.stringify({ conversationId, mediaType })}::jsonb
          )
        `);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "outbox_events" (
            "aggregate_type", "aggregate_id", "event_type", "payload"
          )
          SELECT 'call_session', ${callId}::uuid, 'call.started',
            jsonb_build_object(
              'callId', ${callId},
              'conversationId', ${conversationId},
              'initiatorUserId', ${actorUserId},
              'recipientUserId', counterpart."user_id"::text,
              'mediaType', ${mediaType}
            )
          FROM "conversation_participants" counterpart
          WHERE counterpart."conversation_id" = ${conversationId}::uuid
            AND counterpart."left_at" IS NULL
            AND counterpart."user_id" <> ${actorUserId}::uuid
        `);
        const created = await selectCall(transaction, actorUserId, callId);
        if (!created) throw AppError.notFound('CALL_NOT_FOUND');
        return toRecord(created);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
        throw AppError.conflict('CALL_ALREADY_ACTIVE', 'Ya hay una llamada abierta para esta conversación.');
      }
      throw error;
    }
  }

  async findForParticipant(actorUserId: string, callId: string): Promise<CallSessionRecord> {
    const row = await selectCall(this.prisma, actorUserId, callId);
    if (!row) throw AppError.notFound('CALL_NOT_FOUND');
    return toRecord(row);
  }

  async join(
    actorUserId: string,
    callId: string,
    maximumDurationSeconds: number,
    audit: CallAuditContext
  ): Promise<CallSessionRecord> {
    const outcome = await this.prisma.$transaction(async (transaction) => {
      const current = await selectCall(transaction, actorUserId, callId);
      if (!current) throw AppError.notFound('CALL_NOT_FOUND');
      const now = new Date();
      if (current.status === 'RINGING' && current.expiresAt <= now) {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE "call_sessions"
             SET "status" = 'MISSED', "ended_at" = ${now}, "updated_at" = ${now}
           WHERE "id" = ${callId}::uuid AND "status" = 'RINGING'
        `);
        await this.writeCallEvent(transaction, callId, current.conversationId, 'MISSED', [current.initiatorUserId, current.counterpartUserId]);
        return { expired: true, row: current };
      }
      if (current.status !== 'RINGING' && current.status !== 'ACTIVE') {
        throw AppError.conflict('CALL_NO_LONGER_AVAILABLE', 'Esta llamada ya finalizó.');
      }
      const acceptedByCallee = current.status === 'RINGING' && current.initiatorUserId !== actorUserId;
      if (acceptedByCallee) {
        const expiresAt = new Date(now.getTime() + maximumDurationSeconds * 1000);
        await transaction.$executeRaw(Prisma.sql`
          UPDATE "call_sessions"
             SET "status" = 'ACTIVE', "accepted_at" = ${now}, "expires_at" = ${expiresAt}, "updated_at" = ${now}
           WHERE "id" = ${callId}::uuid AND "status" = 'RINGING'
        `);
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "audit_events" (
            "actor_user_id", "action", "resource_type", "resource_id", "request_id", "ip_address", "metadata"
          ) VALUES (
            ${actorUserId}::uuid, 'call.accepted', 'call_session', ${callId}::uuid,
            ${audit.requestId ?? null}, ${audit.ipAddress ?? null}::inet,
            ${JSON.stringify({ conversationId: current.conversationId })}::jsonb
          )
        `);
        await this.writeCallEvent(transaction, callId, current.conversationId, 'ACTIVE', [current.initiatorUserId, current.counterpartUserId]);
      }
      const updated = await selectCall(transaction, actorUserId, callId);
      if (!updated) throw AppError.notFound('CALL_NOT_FOUND');
      return { expired: false, row: updated };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (outcome.expired) throw AppError.conflict('CALL_NO_LONGER_AVAILABLE', 'Esta llamada ya venció.');
    return toRecord(outcome.row);
  }

  async finish(
    actorUserId: string,
    callId: string,
    outcome: 'ENDED' | 'DECLINED',
    audit: CallAuditContext
  ): Promise<CallSessionRecord> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await selectCall(transaction, actorUserId, callId);
      if (!current) throw AppError.notFound('CALL_NOT_FOUND');
      if (current.status === 'ENDED' || current.status === 'DECLINED' || current.status === 'MISSED') {
        return toRecord(current);
      }
      if (outcome === 'DECLINED' && (current.status !== 'RINGING' || current.initiatorUserId === actorUserId)) {
        throw AppError.conflict('CALL_CANNOT_BE_DECLINED', 'Esta llamada ya no se puede rechazar.');
      }
      const now = new Date();
      await transaction.$executeRaw(Prisma.sql`
        UPDATE "call_sessions"
           SET "status" = ${outcome}::call_session_status, "ended_at" = ${now}, "updated_at" = ${now}
         WHERE "id" = ${callId}::uuid
      `);
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "audit_events" (
          "actor_user_id", "action", "resource_type", "resource_id", "request_id", "ip_address", "metadata"
        ) VALUES (
          ${actorUserId}::uuid, ${outcome === 'DECLINED' ? 'call.declined' : 'call.ended'},
          'call_session', ${callId}::uuid, ${audit.requestId ?? null}, ${audit.ipAddress ?? null}::inet,
          ${JSON.stringify({ conversationId: current.conversationId })}::jsonb
        )
      `);
      await this.writeCallEvent(
        transaction,
        callId,
        current.conversationId,
        outcome,
        [current.initiatorUserId, current.counterpartUserId]
      );
      const updated = await selectCall(transaction, actorUserId, callId);
      if (!updated) throw AppError.notFound('CALL_NOT_FOUND');
      return toRecord(updated);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async writeCallEvent(
    transaction: Prisma.TransactionClient,
    callId: string,
    conversationId: string,
    status: CallSessionStatus,
    userIds: readonly string[]
  ): Promise<void> {
    const eventType = status === 'ACTIVE' ? 'call.accepted' : 'call.finished';
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO "outbox_events" (
        "aggregate_type", "aggregate_id", "event_type", "payload"
      ) VALUES (
        'call_session', ${callId}::uuid, ${eventType},
        ${JSON.stringify({ callId, conversationId, status, userIds })}::jsonb
      )
    `);
  }
}
