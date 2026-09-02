import { apiV1Request } from '../services/apiClient';

export type MentaScope = 'PATIENT' | 'PSYCHOLOGIST';
export type MentaProviderOutcome = 'NOT_USED' | 'SUCCEEDED' | 'UNAVAILABLE' | 'REJECTED_OUTPUT';
export type MentaToolCode =
  | 'get_my_agenda'
  | 'get_my_requests'
  | 'find_psychologists'
  | 'list_my_patients'
  | 'get_patient_context';

export interface MentaTurn {
  readonly id: string;
  readonly clientMessageId: string;
  readonly userMessage: string;
  readonly assistantMessage: string;
  readonly providerOutcome: MentaProviderOutcome;
  readonly modelName: string | null;
  readonly toolsUsed: readonly MentaToolCode[];
  readonly createdAt: string;
  readonly completedAt: string;
}

export interface MentaConversation {
  readonly id: string;
  readonly scope: MentaScope;
  readonly consentVersion: string;
  readonly consentedAt: string;
  readonly turns: readonly MentaTurn[];
}

export interface MentaBootstrap {
  readonly enabled: boolean;
  readonly scope: MentaScope;
  readonly consentVersion: string;
  readonly disclosure: string;
  readonly suggestedPrompts: readonly string[];
  readonly conversation: MentaConversation | null;
}

interface Envelope<T> { readonly data: T }

export async function fetchMentaBootstrap(
  scope: MentaScope,
  signal?: AbortSignal
): Promise<MentaBootstrap> {
  return (await apiV1Request<Envelope<MentaBootstrap>>(
    `/menta/bootstrap?scope=${encodeURIComponent(scope)}`,
    'GET',
    undefined,
    { signal }
  )).data;
}

export async function openMentaConversation(
  scope: MentaScope
): Promise<MentaConversation> {
  return (await apiV1Request<Envelope<MentaConversation>>(
    '/menta/conversations',
    'POST',
    { scope, consentGranted: true }
  )).data;
}

export async function sendMentaMessage(
  conversationId: string,
  clientMessageId: string,
  message: string
): Promise<MentaTurn> {
  return (await apiV1Request<Envelope<MentaTurn>>(
    `/menta/conversations/${encodeURIComponent(conversationId)}/turns`,
    'POST',
    { clientMessageId, message }
  )).data;
}
