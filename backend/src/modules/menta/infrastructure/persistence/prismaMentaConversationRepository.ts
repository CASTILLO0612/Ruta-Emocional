import { randomUUID } from 'crypto';
import {
  MentaTurnStatus,
  Prisma,
  PrismaClient,
} from '../../../../generated/prisma/client';
import { AppError } from '../../../../shared/domain/appError';
import type { ClinicalContentCipher } from '../../../clinical-record/application/ports';
import type {
  MentaAuditContext,
  MentaConversationRepository,
  MentaReplayedTurn,
  MentaStartedTurn,
} from '../../application/ports';
import type {
  MentaAgentReply,
  MentaConversationView,
  MentaScope,
  MentaToolCode,
  MentaToolOutcome,
  MentaTurnView,
} from '../../domain/mentaTypes';

const conversationInclude = {
  turns: {
    where: { status: MentaTurnStatus.COMPLETED },
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
    take: 50,
    include: { toolInvocations: { orderBy: { invokedAt: 'asc' as const } } },
  },
} satisfies Prisma.MentaConversationInclude;

const turnInclude = {
  toolInvocations: { orderBy: { invokedAt: 'asc' as const } },
} satisfies Prisma.MentaTurnInclude;

type ConversationRow = Prisma.MentaConversationGetPayload<{ include: typeof conversationInclude }>;
type TurnRow = Prisma.MentaTurnGetPayload<{ include: typeof turnInclude }>;

export class PrismaMentaConversationRepository implements MentaConversationRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly cipher: ClinicalContentCipher
  ) {}

  async findOpenConversation(userId: string, scope: MentaScope): Promise<MentaConversationView | null> {
    const conversation = await this.prisma.mentaConversation.findFirst({
      where: { userId, scope, closedAt: null },
      include: conversationInclude,
    });
    return conversation ? this.toConversation(conversation) : null;
  }

  async createOrFindOpenConversation(
    userId: string,
    scope: MentaScope,
    consentVersion: string,
    audit: MentaAuditContext
  ): Promise<MentaConversationView> {
    const conversationId = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${`${userId}:${scope}`}, 0))
      `);
      const current = await transaction.mentaConversation.findFirst({
        where: { userId, scope, closedAt: null },
      });
      if (current?.consentVersion === consentVersion) return current.id;
      if (current) {
        await transaction.mentaConversation.update({
          where: { id: current.id },
          data: { closedAt: new Date() },
        });
      }
      const created = await transaction.mentaConversation.create({
        data: { userId, scope, consentVersion },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: audit.actorUserId,
          action: 'menta.conversation_opened',
          resourceType: 'menta_conversation',
          resourceId: created.id,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
          metadata: { scope, consentVersion },
        },
      });
      return created.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.requireOwnedConversation(userId, conversationId);
  }

  async requireOwnedConversation(userId: string, conversationId: string): Promise<MentaConversationView> {
    const conversation = await this.prisma.mentaConversation.findFirst({
      where: { id: conversationId, userId, closedAt: null },
      include: conversationInclude,
    });
    if (!conversation) throw AppError.notFound('MENTA_CONVERSATION_NOT_FOUND');
    return this.toConversation(conversation);
  }

  async startTurn(
    userId: string,
    conversationId: string,
    clientMessageId: string,
    message: string,
    historyLimit: number,
    audit: MentaAuditContext
  ): Promise<MentaStartedTurn | MentaReplayedTurn> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${conversationId}, 0))
      `);
      const conversation = await transaction.mentaConversation.findFirst({
        where: { id: conversationId, userId, closedAt: null },
        select: { id: true },
      });
      if (!conversation) throw AppError.notFound('MENTA_CONVERSATION_NOT_FOUND');

      const existing = await transaction.mentaTurn.findUnique({
        where: { conversationId_clientMessageId: { conversationId, clientMessageId } },
        include: turnInclude,
      });
      if (existing?.status === 'COMPLETED') {
        return { kind: 'REPLAY', turn: this.toTurn(existing) };
      }
      if (existing) {
        throw AppError.conflict(
          'MENTA_TURN_NOT_REPLAYABLE',
          existing.status === 'PROCESSING'
            ? 'El mensaje todavía se está procesando.'
            : 'El intento anterior no terminó. Envía el mensaje nuevamente.'
        );
      }

      const historyRows = await transaction.mentaTurn.findMany({
        where: { conversationId, status: 'COMPLETED' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: historyLimit,
        include: turnInclude,
      });
      const turnId = randomUUID();
      await transaction.mentaTurn.create({
        data: {
          id: turnId,
          conversationId,
          clientMessageId,
          userContentEncrypted: this.cipher.encrypt(message, this.userContentContext(turnId)),
        },
      });
      await transaction.mentaConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: audit.actorUserId,
          action: 'menta.message_submitted',
          resourceType: 'menta_turn',
          resourceId: turnId,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });
      return {
        kind: 'STARTED',
        turnId,
        history: historyRows.reverse().map((turn) => ({
          userMessage: this.cipher.decrypt(
            turn.userContentEncrypted,
            this.userContentContext(turn.id)
          ),
          assistantMessage: this.cipher.decrypt(
            turn.assistantContentEncrypted!,
            this.assistantContentContext(turn.id)
          ),
        })),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async completeTurn(
    userId: string,
    turnId: string,
    reply: MentaAgentReply,
    audit: MentaAuditContext
  ): Promise<MentaTurnView> {
    const completed = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw(Prisma.sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${turnId}, 0))
      `);
      const turn = await transaction.mentaTurn.findFirst({
        where: { id: turnId, conversation: { userId, closedAt: null } },
        include: turnInclude,
      });
      if (!turn) throw AppError.notFound('MENTA_TURN_NOT_FOUND');
      if (turn.status === 'COMPLETED') return turn;
      if (turn.status !== 'PROCESSING') {
        throw AppError.conflict('MENTA_TURN_ALREADY_FAILED', 'El mensaje anterior no pudo completarse.');
      }
      const now = new Date();
      const updated = await transaction.mentaTurn.update({
        where: { id: turnId },
        data: {
          assistantContentEncrypted: this.cipher.encrypt(
            reply.text,
            this.assistantContentContext(turnId)
          ),
          status: 'COMPLETED',
          providerOutcome: reply.outcome,
          modelName: reply.modelName,
          completedAt: now,
        },
        include: turnInclude,
      });
      await transaction.mentaConversation.update({
        where: { id: turn.conversationId },
        data: { updatedAt: now },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: audit.actorUserId,
          action: 'menta.response_completed',
          resourceType: 'menta_turn',
          resourceId: turnId,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
          metadata: { providerOutcome: reply.outcome, toolCount: reply.toolsUsed.length },
        },
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.toTurn(completed);
  }

  async failTurn(userId: string, turnId: string, audit: MentaAuditContext): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.mentaTurn.updateMany({
        where: { id: turnId, status: 'PROCESSING', conversation: { userId } },
        data: { status: 'FAILED', completedAt: new Date() },
      });
      if (result.count === 0) return;
      await transaction.auditEvent.create({
        data: {
          actorUserId: audit.actorUserId,
          action: 'menta.response_failed',
          resourceType: 'menta_turn',
          resourceId: turnId,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
        },
      });
    });
  }

  async recordToolInvocation(
    turnId: string,
    toolCode: MentaToolCode,
    outcome: MentaToolOutcome,
    resourceType: string | undefined,
    resourceCount: number | undefined,
    audit: MentaAuditContext
  ): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const turn = await transaction.mentaTurn.findFirst({
        where: { id: turnId, conversation: { userId: audit.actorUserId } },
        select: { id: true },
      });
      if (!turn) throw AppError.notFound('MENTA_TURN_NOT_FOUND');
      const invocation = await transaction.mentaToolInvocation.create({
        data: { turnId, toolCode, outcome, resourceType, resourceCount },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: audit.actorUserId,
          action: 'menta.tool_invoked',
          resourceType: 'menta_tool_invocation',
          resourceId: invocation.id,
          requestId: audit.requestId,
          ipAddress: audit.ipAddress,
          metadata: { toolCode, outcome, resourceType, resourceCount },
        },
      });
    });
  }

  private toConversation(row: ConversationRow): MentaConversationView {
    return {
      id: row.id,
      scope: row.scope as MentaScope,
      consentVersion: row.consentVersion,
      consentedAt: row.consentedAt.toISOString(),
      turns: [...row.turns].reverse().map((turn) => this.toTurn(turn)),
    };
  }

  private toTurn(row: TurnRow): MentaTurnView {
    if (!row.assistantContentEncrypted || !row.completedAt) {
      throw new Error('Completed MENTA turn is missing its assistant response');
    }
    return {
      id: row.id,
      clientMessageId: row.clientMessageId,
      userMessage: this.cipher.decrypt(row.userContentEncrypted, this.userContentContext(row.id)),
      assistantMessage: this.cipher.decrypt(
        row.assistantContentEncrypted,
        this.assistantContentContext(row.id)
      ),
      providerOutcome: row.providerOutcome,
      modelName: row.modelName,
      toolsUsed: row.toolInvocations
        .filter(({ outcome }) => outcome === 'SUCCEEDED')
        .map(({ toolCode }) => toolCode as MentaToolCode),
      createdAt: row.createdAt.toISOString(),
      completedAt: row.completedAt.toISOString(),
    };
  }

  private userContentContext(turnId: string): string {
    return `menta-turn:${turnId}:user`;
  }

  private assistantContentContext(turnId: string): string {
    return `menta-turn:${turnId}:assistant`;
  }
}
