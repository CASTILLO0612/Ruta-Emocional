import type {
  MentaAgentProvider,
  MentaAgentProviderObserver,
  MentaAgentProviderRequest,
} from '../../application/ports';
import type { MentaAgentReply, MentaToolCode } from '../../domain/mentaTypes';

type OllamaMessage = Readonly<Record<string, unknown>>;

interface OllamaResponse {
  readonly model?: unknown;
  readonly message?: unknown;
}

interface OllamaChatResult {
  readonly response: OllamaResponse;
  readonly emittedText: boolean;
}

interface ToolCall {
  readonly name: MentaToolCode;
  readonly argumentsValue: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function responseMessage(response: OllamaResponse): Record<string, unknown> {
  if (!isRecord(response.message)) throw new Error('Ollama returned an invalid message');
  return response.message;
}

function toolCalls(
  message: Record<string, unknown>,
  allowedTools: ReadonlySet<string>
): readonly ToolCall[] {
  if (!Array.isArray(message.tool_calls)) return [];
  return message.tool_calls.flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.function)) return [];
    const name = item.function.name;
    if (typeof name !== 'string' || !allowedTools.has(name)) return [];
    return [{
      name: name as MentaToolCode,
      argumentsValue: isRecord(item.function.arguments) ? item.function.arguments : {},
    }];
  });
}

function compactText(value: string, maximumLength: number): string {
  if (maximumLength <= 0) return '';
  if (value.length <= maximumLength) return value;
  if (maximumLength === 1) return '…';
  return `${value.slice(0, maximumLength - 1)}…`;
}

function compactHistory(
  history: readonly MentaAgentProviderRequest['history'][number][],
  maximumLength: number
): readonly MentaAgentProviderRequest['history'][number][] {
  const selected: MentaAgentProviderRequest['history'][number][] = [];
  let remaining = maximumLength;

  for (const turn of [...history].reverse()) {
    if (remaining <= 0) break;
    const length = turn.userMessage.length + turn.assistantMessage.length;
    if (length <= remaining) {
      selected.push(turn);
      remaining -= length;
      continue;
    }

    const userBudget = Math.min(turn.userMessage.length, Math.ceil(remaining / 2));
    const assistantBudget = Math.max(0, remaining - userBudget);
    selected.push({
      userMessage: compactText(turn.userMessage, userBudget),
      assistantMessage: compactText(turn.assistantMessage, assistantBudget),
    });
    break;
  }

  return selected.reverse();
}

function conversationMessages(
  request: MentaAgentProviderRequest,
  maximumHistoryCharacters: number
): OllamaMessage[] {
  return [
    { role: 'system', content: request.systemInstruction },
    ...compactHistory(request.history, maximumHistoryCharacters).flatMap((turn) => [
      { role: 'user', content: turn.userMessage },
      { role: 'assistant', content: turn.assistantMessage },
    ]),
    { role: 'user', content: request.message },
  ];
}

function ollamaTools(request: MentaAgentProviderRequest): readonly Record<string, unknown>[] {
  return request.tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export class OllamaMentaAgentProvider implements MentaAgentProvider {
  constructor(private readonly options: {
    readonly baseUrl: string;
    readonly model: string;
    readonly timeoutMs: number;
    readonly maximumToolRounds: number;
    readonly keepAlive: string;
    readonly maximumHistoryCharacters: number;
    readonly maximumOutputTokens: number;
    readonly toolCallingEnabled: boolean;
    readonly fetchImplementation?: typeof fetch;
  }) {}

  async generateReply(
    request: MentaAgentProviderRequest,
    observer?: MentaAgentProviderObserver
  ): Promise<MentaAgentReply> {
    const messages = conversationMessages(request, this.options.maximumHistoryCharacters);
    const tools = this.options.toolCallingEnabled ? ollamaTools(request) : [];
    const allowedTools = new Set(request.tools.map(({ name }) => name));
    const toolsUsed: MentaToolCode[] = [];

    for (let round = 0; round <= this.options.maximumToolRounds; round += 1) {
      const result = await this.chat(messages, tools, observer);
      const response = result.response;
      const message = responseMessage(response);
      const calls = toolCalls(message, allowedTools);
      messages.push(message);
      if (calls.length === 0) {
        const text = typeof message.content === 'string' ? message.content.trim() : '';
        if (!text) throw new Error('Ollama did not return a text response');
        if (observer && !result.emittedText) observer.onTextDelta(text);
        return {
          text,
          outcome: 'SUCCEEDED',
          modelName: typeof response.model === 'string' ? response.model : this.options.model,
          toolsUsed: [...new Set(toolsUsed)],
        };
      }
      if (round === this.options.maximumToolRounds) {
        throw new Error('Ollama exceeded the maximum number of tool rounds');
      }
      for (const call of calls) {
        toolsUsed.push(call.name);
        let result: unknown;
        try {
          result = (await request.executeTool(call.name, call.argumentsValue)).data;
        } catch {
          result = { error: 'La herramienta no está autorizada o no está disponible.' };
        }
        messages.push({
          role: 'tool',
          tool_name: call.name,
          content: JSON.stringify(result),
        });
      }
    }

    throw new Error('Ollama agent loop ended unexpectedly');
  }

  private async chat(
    messages: readonly OllamaMessage[],
    tools: readonly Record<string, unknown>[],
    observer?: MentaAgentProviderObserver
  ): Promise<OllamaChatResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    const abortFromObserver = () => controller.abort();
    observer?.signal?.addEventListener('abort', abortFromObserver, { once: true });
    if (observer?.signal?.aborted) controller.abort();
    try {
      const response = await (this.options.fetchImplementation ?? fetch)(
        `${this.options.baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.options.model,
            messages,
            ...(tools.length > 0 ? { tools } : {}),
            stream: Boolean(observer),
            think: false,
            keep_alive: this.options.keepAlive,
            options: {
              temperature: 0.2,
              num_predict: this.options.maximumOutputTokens,
            },
          }),
          signal: controller.signal,
        }
      );
      if (!response.ok) throw new Error(`Ollama request failed with status ${response.status}`);
      if (observer) return this.readStream(response, tools.length === 0 ? observer : undefined);
      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new Error('Ollama returned invalid JSON');
      return { response: payload, emittedText: false };
    } finally {
      clearTimeout(timeout);
      observer?.signal?.removeEventListener('abort', abortFromObserver);
    }
  }

  private async readStream(
    response: Response,
    observer?: MentaAgentProviderObserver
  ): Promise<OllamaChatResult> {
    if (!response.body) throw new Error('Ollama returned an empty stream');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    let model: unknown;
    let content = '';
    let emittedText = false;
    const collectedToolCalls: unknown[] = [];

    const consumeLine = (line: string) => {
      if (!line.trim()) return;
      const payload: unknown = JSON.parse(line);
      if (!isRecord(payload)) throw new Error('Ollama returned an invalid stream event');
      if (payload.model !== undefined) model = payload.model;
      if (!isRecord(payload.message)) return;
      if (typeof payload.message.content === 'string' && payload.message.content) {
        content += payload.message.content;
        observer?.onTextDelta(payload.message.content);
        emittedText = emittedText || Boolean(observer);
      }
      if (Array.isArray(payload.message.tool_calls)) {
        collectedToolCalls.push(...payload.message.tool_calls);
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffered += decoder.decode(value, { stream: !done });
        const lines = buffered.split(/\r?\n/);
        buffered = lines.pop() ?? '';
        lines.forEach(consumeLine);
        if (done) break;
      }
      if (buffered.trim()) consumeLine(buffered);
    } finally {
      reader.releaseLock();
    }

    return {
      response: {
        model,
        message: {
          role: 'assistant',
          content,
          ...(collectedToolCalls.length > 0 ? { tool_calls: collectedToolCalls } : {}),
        },
      },
      emittedText,
    };
  }
}
