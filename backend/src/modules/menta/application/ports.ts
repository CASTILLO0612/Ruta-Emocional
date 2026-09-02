import type { AuthenticatedActor } from '../../identity/application/identityService';
import type {
  MentaAgentReply,
  MentaConversationView,
  MentaProviderTurn,
  MentaScope,
  MentaToolCode,
  MentaToolDeclaration,
  MentaToolExecution,
  MentaToolOutcome,
  MentaTurnView,
} from '../domain/mentaTypes';

export interface MentaAuditContext {
  readonly actorUserId: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface MentaStartedTurn {
  readonly kind: 'STARTED';
  readonly turnId: string;
  readonly history: readonly MentaProviderTurn[];
}

export interface MentaReplayedTurn {
  readonly kind: 'REPLAY';
  readonly turn: MentaTurnView;
}

export interface MentaConversationRepository {
  findOpenConversation(userId: string, scope: MentaScope): Promise<MentaConversationView | null>;
  createOrFindOpenConversation(
    userId: string,
    scope: MentaScope,
    consentVersion: string,
    audit: MentaAuditContext
  ): Promise<MentaConversationView>;
  requireOwnedConversation(userId: string, conversationId: string): Promise<MentaConversationView>;
  startTurn(
    userId: string,
    conversationId: string,
    clientMessageId: string,
    message: string,
    historyLimit: number,
    audit: MentaAuditContext
  ): Promise<MentaStartedTurn | MentaReplayedTurn>;
  completeTurn(
    userId: string,
    turnId: string,
    reply: MentaAgentReply,
    audit: MentaAuditContext
  ): Promise<MentaTurnView>;
  failTurn(userId: string, turnId: string, audit: MentaAuditContext): Promise<void>;
  recordToolInvocation(
    turnId: string,
    toolCode: MentaToolCode,
    outcome: MentaToolOutcome,
    resourceType: string | undefined,
    resourceCount: number | undefined,
    audit: MentaAuditContext
  ): Promise<void>;
}

export interface MentaContextGateway {
  execute(
    actor: AuthenticatedActor,
    scope: MentaScope,
    toolCode: MentaToolCode,
    argumentsValue: Readonly<Record<string, unknown>>
  ): Promise<MentaToolExecution>;
}

export interface MentaAgentProviderRequest {
  readonly systemInstruction: string;
  readonly history: readonly MentaProviderTurn[];
  readonly message: string;
  readonly tools: readonly MentaToolDeclaration[];
  readonly executeTool: (
    toolCode: MentaToolCode,
    argumentsValue: Readonly<Record<string, unknown>>
  ) => Promise<MentaToolExecution>;
}

export interface MentaAgentProvider {
  generateReply(request: MentaAgentProviderRequest): Promise<MentaAgentReply>;
}
