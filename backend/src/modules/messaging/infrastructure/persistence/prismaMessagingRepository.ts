import { MessageType, Prisma, PrismaClient } from '../../../../generated/prisma/client';
import { AppError } from '../../../../shared/domain/appError';
import { MessagingAuditContext, MessagingRepository } from '../../application/ports';
import {
  ConversationView,
  encodeCursor,
  MessagePageQuery,
  MessageView,
  Page,
  PageQuery,
  SendMessageInput,
  SendMessageResult,
} from '../../domain/messagingTypes';

interface ConversationRow {
  readonly id: string;
  readonly serviceRequestId: string;
  readonly careRelationshipId: string;
  readonly modality: 'CHAT' | 'CALL' | 'IN_PERSON';
  readonly createdAt: Date;
  readonly activityAt: Date;
  readonly counterpartUserId: string;
  readonly counterpartDisplayName: string;
  readonly counterpartPhotoUrl: string | null;
  readonly counterpartRole: 'patient' | 'psychologist';
  readonly relationshipStatus: 'ACTIVE' | 'PAUSED' | 'ENDED';
  readonly lastMessageId: string | null;
  readonly lastMessageText: string | null;
  readonly lastMessageSentAt: Date | null;
  readonly lastMessageSenderUserId: string | null;
}

interface MessageRow {
  readonly id: string;
  readonly conversationId: string;
  readonly clientMessageId: string;
  readonly type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'SYSTEM';
  readonly content: string;
  readonly sentAt: Date;
  readonly senderUserId: string;
  readonly senderDisplayName: string;
  readonly senderPhotoUrl: string | null;
  readonly senderRole: 'patient' | 'psychologist';
}

interface ParticipantRow {
  readonly id: string;
}

const activeConversationJoins = Prisma.sql`
  FROM "conversation_participants" mine
  JOIN "conversations" conversation
    ON conversation."id" = mine."conversation_id"
  JOIN "request_conversations" request_link
    ON request_link."conversation_id" = conversation."id"
  JOIN "service_requests" request
    ON request."id" = request_link."service_request_id"
  JOIN "care_relationship_sources" source
    ON source."service_request_id" = request."id"
  JOIN "care_relationships" relationship
    ON relationship."id" = source."care_relationship_id"
`;

function conversationView(row: ConversationRow, userId: string): ConversationView {
  return {
    id: row.id,
    serviceRequestId: row.serviceRequestId,
    careRelationshipId: row.careRelationshipId,
    modality: row.modality,
    counterpart: {
      userId: row.counterpartUserId,
      displayName: row.counterpartDisplayName,
      photoUrl: row.counterpartPhotoUrl,
      role: row.counterpartRole,
    },
    canSend: row.relationshipStatus === 'ACTIVE',
    createdAt: row.createdAt.toISOString(),
    activityAt: row.activityAt.toISOString(),
    lastMessage: row.lastMessageId && row.lastMessageText && row.lastMessageSentAt
      ? {
          id: row.lastMessageId,
          text: row.lastMessageText,
          sentAt: row.lastMessageSentAt.toISOString(),
          isOwn: row.lastMessageSenderUserId === userId,
        }
      : null,
  };
}

function messageView(row: MessageRow, userId: string): MessageView {
  if (row.type !== 'TEXT') {
    throw new Error('Unsupported message type reached the Phase 5 projection');
  }
  return {
    id: row.id,
    conversationId: row.conversationId,
    clientMessageId: row.clientMessageId,
    type: row.type,
    text: row.content,
    sentAt: row.sentAt.toISOString(),
    sender: {
      userId: row.senderUserId,
      displayName: row.senderDisplayName,
      photoUrl: row.senderPhotoUrl,
      role: row.senderRole,
    },
    isOwn: row.senderUserId === userId,
  };
}

export class PrismaMessagingRepository implements MessagingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listConversations(userId: string, query: PageQuery): Promise<Page<ConversationView>> {
    const cursor = query.cursor
      ? Prisma.sql`AND (COALESCE(last_message."sentAt", conversation."created_at"), conversation."id")
          < (${query.cursor.occurredAt}, ${query.cursor.id}::uuid)`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<ConversationRow[]>(Prisma.sql`
      SELECT
        conversation."id",
        request."id" AS "serviceRequestId",
        relationship."id" AS "careRelationshipId",
        request."modality",
        conversation."created_at" AS "createdAt",
        COALESCE(last_message."sentAt", conversation."created_at") AS "activityAt",
        counterpart_user."id" AS "counterpartUserId",
        counterpart_user."display_name" AS "counterpartDisplayName",
        counterpart_user."photo_url" AS "counterpartPhotoUrl",
        CASE WHEN counterpart_psychologist."id" IS NULL THEN 'patient' ELSE 'psychologist' END
          AS "counterpartRole",
        relationship."status" AS "relationshipStatus",
        last_message."id" AS "lastMessageId",
        last_message."content" AS "lastMessageText",
        last_message."sentAt" AS "lastMessageSentAt",
        last_message."senderUserId" AS "lastMessageSenderUserId"
      ${activeConversationJoins}
      JOIN "conversation_participants" counterpart
        ON counterpart."conversation_id" = conversation."id"
       AND counterpart."user_id" <> mine."user_id"
       AND counterpart."left_at" IS NULL
      JOIN "users" counterpart_user
        ON counterpart_user."id" = counterpart."user_id"
      LEFT JOIN "psychologist_profiles" counterpart_psychologist
        ON counterpart_psychologist."user_id" = counterpart_user."id"
      LEFT JOIN LATERAL (
        SELECT message."id", message."content", message."sent_at" AS "sentAt",
               sender."user_id" AS "senderUserId"
         FROM "messages" message
          JOIN "conversation_participants" sender
            ON sender."id" = message."conversation_participant_id"
         WHERE sender."conversation_id" = conversation."id"
           AND message."type" = 'TEXT'
         ORDER BY message."sent_at" DESC, message."id" DESC
         LIMIT 1
      ) last_message ON true
      WHERE mine."user_id" = ${userId}::uuid
        AND mine."left_at" IS NULL
        AND relationship."status" IN ('ACTIVE', 'PAUSED')
        ${cursor}
      ORDER BY "activityAt" DESC, conversation."id" DESC
      LIMIT ${query.limit + 1}
    `);
    const hasMore = rows.length > query.limit;
    const pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    const last = pageRows.at(-1);
    return {
      items: pageRows.map((row) => conversationView(row, userId)),
      nextCursor: hasMore && last
        ? encodeCursor({ occurredAt: last.activityAt, id: last.id })
        : null,
    };
  }

  async findConversation(userId: string, conversationId: string): Promise<ConversationView | null> {
    const rows = await this.prisma.$queryRaw<ConversationRow[]>(Prisma.sql`
      SELECT
        conversation."id",
        request."id" AS "serviceRequestId",
        relationship."id" AS "careRelationshipId",
        request."modality",
        conversation."created_at" AS "createdAt",
        COALESCE(last_message."sentAt", conversation."created_at") AS "activityAt",
        counterpart_user."id" AS "counterpartUserId",
        counterpart_user."display_name" AS "counterpartDisplayName",
        counterpart_user."photo_url" AS "counterpartPhotoUrl",
        CASE WHEN counterpart_psychologist."id" IS NULL THEN 'patient' ELSE 'psychologist' END
          AS "counterpartRole",
        relationship."status" AS "relationshipStatus",
        last_message."id" AS "lastMessageId",
        last_message."content" AS "lastMessageText",
        last_message."sentAt" AS "lastMessageSentAt",
        last_message."senderUserId" AS "lastMessageSenderUserId"
      ${activeConversationJoins}
      JOIN "conversation_participants" counterpart
        ON counterpart."conversation_id" = conversation."id"
       AND counterpart."user_id" <> mine."user_id"
       AND counterpart."left_at" IS NULL
      JOIN "users" counterpart_user ON counterpart_user."id" = counterpart."user_id"
      LEFT JOIN "psychologist_profiles" counterpart_psychologist
        ON counterpart_psychologist."user_id" = counterpart_user."id"
      LEFT JOIN LATERAL (
        SELECT message."id", message."content", message."sent_at" AS "sentAt",
               sender."user_id" AS "senderUserId"
         FROM "messages" message
          JOIN "conversation_participants" sender
            ON sender."id" = message."conversation_participant_id"
         WHERE sender."conversation_id" = conversation."id"
           AND message."type" = 'TEXT'
         ORDER BY message."sent_at" DESC, message."id" DESC
         LIMIT 1
      ) last_message ON true
      WHERE mine."user_id" = ${userId}::uuid
        AND mine."left_at" IS NULL
        AND relationship."status" IN ('ACTIVE', 'PAUSED')
        AND conversation."id" = ${conversationId}::uuid
      LIMIT 1
    `);
    return rows[0] ? conversationView(rows[0], userId) : null;
  }

  async listMessages(
    userId: string,
    conversationId: string,
    query: MessagePageQuery
  ): Promise<Page<MessageView>> {
    if (!await this.canSubscribe(userId, conversationId)) {
      throw AppError.notFound('CONVERSATION_NOT_FOUND');
    }
    const cursor = query.cursor
      ? query.direction === 'after'
        ? Prisma.sql`AND (message."sent_at", message."id") > (${query.cursor.occurredAt}, ${query.cursor.id}::uuid)`
        : Prisma.sql`AND (message."sent_at", message."id") < (${query.cursor.occurredAt}, ${query.cursor.id}::uuid)`
      : Prisma.empty;
    const order = query.direction === 'after'
      ? Prisma.sql`ASC`
      : Prisma.sql`DESC`;
    const rows = await this.prisma.$queryRaw<MessageRow[]>(Prisma.sql`
      SELECT
        message."id",
        participant."conversation_id" AS "conversationId",
        message."client_message_id" AS "clientMessageId",
        message."type",
        message."content",
        message."sent_at" AS "sentAt",
        sender."id" AS "senderUserId",
        sender."display_name" AS "senderDisplayName",
        sender."photo_url" AS "senderPhotoUrl",
        CASE WHEN sender_psychologist."id" IS NULL THEN 'patient' ELSE 'psychologist' END
          AS "senderRole"
      FROM "messages" message
      JOIN "conversation_participants" participant
        ON participant."id" = message."conversation_participant_id"
      JOIN "users" sender ON sender."id" = participant."user_id"
      LEFT JOIN "psychologist_profiles" sender_psychologist
        ON sender_psychologist."user_id" = sender."id"
      WHERE participant."conversation_id" = ${conversationId}::uuid
        AND message."type" = 'TEXT'
        ${cursor}
      ORDER BY message."sent_at" ${order}, message."id" ${order}
      LIMIT ${query.limit + 1}
    `);
    const hasMore = rows.length > query.limit;
    let pageRows = hasMore ? rows.slice(0, query.limit) : rows;
    if (query.direction === 'before') pageRows = [...pageRows].reverse();
    const cursorRow = query.direction === 'before' ? pageRows[0] : pageRows.at(-1);
    return {
      items: pageRows.map((row) => messageView(row, userId)),
      nextCursor: hasMore && cursorRow
        ? encodeCursor({ occurredAt: cursorRow.sentAt, id: cursorRow.id })
        : null,
    };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    input: SendMessageInput,
    audit: MessagingAuditContext
  ): Promise<SendMessageResult> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${`message:${userId}:${conversationId}:${input.clientMessageId}`}, 0)
        )
      `);
      const participant = await this.findActiveParticipant(transaction, userId, conversationId);
      if (!participant) throw AppError.notFound('CONVERSATION_NOT_FOUND');

      const existing = await transaction.message.findUnique({
        where: {
          conversationParticipantId_clientMessageId: {
            conversationParticipantId: participant.id,
            clientMessageId: input.clientMessageId,
          },
        },
        include: { participant: { include: { user: { include: { psychologistProfile: true } } } } },
      });
      if (existing) {
        if (existing.type !== MessageType.TEXT || existing.content !== input.text) {
          throw AppError.conflict(
            'CLIENT_MESSAGE_ID_REUSED',
            'El identificador del mensaje ya fue usado con otro contenido.'
          );
        }
        return { message: this.prismaMessageView(existing, userId), replayed: true };
      }

      const created = await transaction.message.create({
        data: {
          conversationParticipantId: participant.id,
          clientMessageId: input.clientMessageId,
          type: MessageType.TEXT,
          content: input.text,
        },
        include: { participant: { include: { user: { include: { psychologistProfile: true } } } } },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: audit.actorUserId,
          action: 'message.created',
          resourceType: 'message',
          resourceId: created.id,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
          metadata: { conversationId, type: 'TEXT' },
        },
      });
      await transaction.outboxEvent.create({
        data: {
          aggregateType: 'conversation',
          aggregateId: conversationId,
          eventType: 'message.created',
          payload: { conversationId, messageId: created.id },
        },
      });
      return { message: this.prismaMessageView(created, userId), replayed: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async canSubscribe(userId: string, conversationId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<ParticipantRow[]>(Prisma.sql`
      SELECT mine."id"
      ${activeConversationJoins}
      WHERE mine."user_id" = ${userId}::uuid
        AND mine."left_at" IS NULL
        AND relationship."status" IN ('ACTIVE', 'PAUSED')
        AND conversation."id" = ${conversationId}::uuid
      LIMIT 1
    `);
    return Boolean(rows[0]);
  }

  async findMessageForDelivery(messageId: string): Promise<MessageView | null> {
    const row = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { participant: { include: { user: { include: { psychologistProfile: true } } } } },
    });
    return row ? this.prismaMessageView(row, '') : null;
  }

  private async findActiveParticipant(
    client: PrismaClient | Prisma.TransactionClient,
    userId: string,
    conversationId: string
  ): Promise<ParticipantRow | null> {
    const rows = await client.$queryRaw<ParticipantRow[]>(Prisma.sql`
      SELECT mine."id"
      ${activeConversationJoins}
      WHERE mine."user_id" = ${userId}::uuid
        AND mine."left_at" IS NULL
        AND relationship."status" = 'ACTIVE'
        AND conversation."id" = ${conversationId}::uuid
      LIMIT 1
    `);
    return rows[0] ?? null;
  }

  private prismaMessageView(
    row: Prisma.MessageGetPayload<{
      include: { participant: { include: { user: { include: { psychologistProfile: true } } } } };
    }>,
    currentUserId: string
  ): MessageView {
    if (row.type !== MessageType.TEXT) {
      throw new Error('Unsupported message type reached the Phase 5 projection');
    }
    const sender = row.participant.user;
    return {
      id: row.id,
      conversationId: row.participant.conversationId,
      clientMessageId: row.clientMessageId,
      type: 'TEXT',
      text: row.content,
      sentAt: row.sentAt.toISOString(),
      sender: {
        userId: sender.id,
        displayName: sender.displayName,
        photoUrl: sender.photoUrl,
        role: sender.psychologistProfile ? 'psychologist' : 'patient',
      },
      isOwn: sender.id === currentUserId,
    };
  }
}
