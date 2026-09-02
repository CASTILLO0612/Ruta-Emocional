import { AuthenticatedActor } from '../../identity/application/identityService';
import { AppError } from '../../../shared/domain/appError';
import { MessagingAuditContext, MessagingRepository } from './ports';
import { MessagePageQuery, PageQuery, SendMessageInput } from '../domain/messagingTypes';
import { AppConfig } from '../../../config/env';

export class MessagingService {
  constructor(
    private readonly repository: MessagingRepository,
    private readonly policy: AppConfig['messaging']
  ) {}

  getPolicy() {
    return { maximumTextLength: this.policy.maximumTextLength };
  }

  listConversations(actor: AuthenticatedActor, query: PageQuery) {
    this.assertCapability(actor, 'conversation:read:self');
    return this.repository.listConversations(actor.user.id, query);
  }

  async findConversation(actor: AuthenticatedActor, conversationId: string) {
    this.assertCapability(actor, 'conversation:read:self');
    const conversation = await this.repository.findConversation(actor.user.id, conversationId);
    if (!conversation) throw AppError.notFound('CONVERSATION_NOT_FOUND');
    return conversation;
  }

  listMessages(
    actor: AuthenticatedActor,
    conversationId: string,
    query: MessagePageQuery
  ) {
    this.assertCapability(actor, 'conversation:read:self');
    return this.repository.listMessages(actor.user.id, conversationId, query);
  }

  sendMessage(
    actor: AuthenticatedActor,
    conversationId: string,
    input: SendMessageInput,
    audit: MessagingAuditContext
  ) {
    this.assertCapability(actor, 'conversation:send:self');
    return this.repository.sendMessage(actor.user.id, conversationId, input, audit);
  }

  async authorizeSubscription(actor: AuthenticatedActor, conversationId: string): Promise<void> {
    this.assertCapability(actor, 'conversation:read:self');
    if (!await this.repository.canSubscribe(actor.user.id, conversationId)) {
      throw AppError.notFound('CONVERSATION_NOT_FOUND');
    }
  }

  findMessageForDelivery(messageId: string) {
    return this.repository.findMessageForDelivery(messageId);
  }

  private assertCapability(actor: AuthenticatedActor, capability: string): void {
    if (!actor.user.capabilities.includes(capability)) {
      throw AppError.forbidden('CAPABILITY_REQUIRED');
    }
  }
}
