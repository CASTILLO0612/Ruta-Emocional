import {
  ConversationView,
  MessagePageQuery,
  MessageView,
  Page,
  PageQuery,
  SendMessageInput,
  SendMessageResult,
} from '../domain/messagingTypes';

export interface MessagingAuditContext {
  readonly actorUserId: string;
  readonly requestId?: string;
  readonly ipAddress?: string;
}

export interface MessagingRepository {
  listConversations(userId: string, query: PageQuery): Promise<Page<ConversationView>>;
  findConversation(userId: string, conversationId: string): Promise<ConversationView | null>;
  listMessages(
    userId: string,
    conversationId: string,
    query: MessagePageQuery
  ): Promise<Page<MessageView>>;
  sendMessage(
    userId: string,
    conversationId: string,
    input: SendMessageInput,
    audit: MessagingAuditContext
  ): Promise<SendMessageResult>;
  canSubscribe(userId: string, conversationId: string): Promise<boolean>;
  findMessageForDelivery(messageId: string): Promise<MessageView | null>;
}
