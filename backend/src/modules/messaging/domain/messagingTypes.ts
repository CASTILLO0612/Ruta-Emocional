export type ConversationParticipantRole = 'patient' | 'psychologist';

export interface ConversationCounterpartView {
  readonly userId: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly role: ConversationParticipantRole;
}

export interface ConversationLastMessageView {
  readonly id: string;
  readonly text: string;
  readonly sentAt: string;
  readonly isOwn: boolean;
}

export interface ConversationView {
  readonly id: string;
  readonly serviceRequestId: string;
  readonly careRelationshipId: string;
  readonly modality: 'CHAT' | 'CALL' | 'IN_PERSON';
  readonly counterpart: ConversationCounterpartView;
  readonly canSend: boolean;
  readonly createdAt: string;
  readonly activityAt: string;
  readonly lastMessage: ConversationLastMessageView | null;
}

export interface MessageSenderView extends ConversationCounterpartView {}

export interface MessageView {
  readonly id: string;
  readonly conversationId: string;
  readonly clientMessageId: string;
  readonly type: 'TEXT';
  readonly text: string;
  readonly sentAt: string;
  readonly sender: MessageSenderView;
  readonly isOwn: boolean;
}

export interface CursorPosition {
  readonly occurredAt: Date;
  readonly id: string;
}

export interface PageQuery {
  readonly limit: number;
  readonly cursor?: CursorPosition;
}

export interface MessagePageQuery extends PageQuery {
  readonly direction: 'before' | 'after';
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export interface SendMessageInput {
  readonly clientMessageId: string;
  readonly type: 'TEXT';
  readonly text: string;
}

export interface SendMessageResult {
  readonly message: MessageView;
  readonly replayed: boolean;
}

export function encodeCursor(position: CursorPosition): string {
  return Buffer.from(JSON.stringify({
    occurredAt: position.occurredAt.toISOString(),
    id: position.id,
  }), 'utf8').toString('base64url');
}
