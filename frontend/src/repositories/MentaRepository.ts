import { ApiError, apiV1EventStream, apiV1Request } from '../services/apiClient';

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

interface MentaStreamHandlers {
  readonly onStatus?: (message: string) => void;
  readonly onDelta: (delta: string) => void;
  readonly onReplace?: (text: string) => void;
}

interface ServerSentEvent {
  readonly event: string;
  readonly data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseMentaServerSentEvent(frame: string): ServerSentEvent | null {
  const lines = frame.split(/\r?\n/);
  const event = lines
    .find((line) => line.startsWith('event:'))
    ?.slice('event:'.length)
    .trim();
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice('data:'.length).trimStart())
    .join('\n');
  if (!event || !data) return null;
  try {
    return { event, data: JSON.parse(data) as unknown };
  } catch {
    throw new ApiError({
      status: 200,
      code: 'INVALID_STREAM_EVENT',
      message: 'La respuesta de MENTA no pudo interpretarse.',
    });
  }
}

function streamMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.message === 'string' && value.message.trim()
    ? value.message.trim()
    : fallback;
}

function streamDelta(value: unknown): string {
  return isRecord(value) && typeof value.delta === 'string' ? value.delta : '';
}

function streamText(value: unknown): string {
  return isRecord(value) && typeof value.text === 'string' ? value.text : '';
}

function streamTurn(value: unknown): MentaTurn {
  if (!isRecord(value) || !isRecord(value.turn)) {
    throw new ApiError({
      status: 200,
      code: 'INVALID_STREAM_COMPLETION',
      message: 'MENTA no pudo completar la respuesta.',
    });
  }
  return value.turn as unknown as MentaTurn;
}

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

export async function restartMentaConversation(
  conversationId: string
): Promise<MentaConversation> {
  return (await apiV1Request<Envelope<MentaConversation>>(
    `/menta/conversations/${encodeURIComponent(conversationId)}/restart`,
    'POST'
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

export async function sendMentaMessageStream(
  conversationId: string,
  clientMessageId: string,
  message: string,
  handlers: MentaStreamHandlers,
  signal?: AbortSignal
): Promise<MentaTurn> {
  const stream = await apiV1EventStream(
    `/menta/conversations/${encodeURIComponent(conversationId)}/turns/stream`,
    'POST',
    { clientMessageId, message },
    { signal }
  );
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffered = '';
  let completed: MentaTurn | null = null;

  const consumeFrame = (frame: string) => {
    const event = parseMentaServerSentEvent(frame);
    if (!event) return;
    if (event.event === 'status') {
      handlers.onStatus?.(streamMessage(event.data, 'MENTA está preparando una respuesta.'));
      return;
    }
    if (event.event === 'delta') {
      const delta = streamDelta(event.data);
      if (delta) handlers.onDelta(delta);
      return;
    }
    if (event.event === 'replace') {
      handlers.onReplace?.(streamText(event.data));
      return;
    }
    if (event.event === 'completed') {
      completed = streamTurn(event.data);
      return;
    }
    if (event.event === 'error') {
      throw new ApiError({
        status: 500,
        code: 'MENTA_STREAM_FAILED',
        message: streamMessage(event.data, 'No pudimos completar la respuesta de MENTA.'),
      });
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffered += decoder.decode(value, { stream: !done });
      const frames = buffered.split(/\r?\n\r?\n/);
      buffered = frames.pop() ?? '';
      frames.forEach(consumeFrame);
      if (done) break;
    }
    if (buffered.trim()) consumeFrame(buffered);
  } finally {
    reader.releaseLock();
  }

  if (!completed) {
    throw new ApiError({
      status: 200,
      code: 'INCOMPLETE_STREAM',
      message: 'MENTA no terminó la respuesta. Inténtalo nuevamente.',
    });
  }
  return completed;
}
