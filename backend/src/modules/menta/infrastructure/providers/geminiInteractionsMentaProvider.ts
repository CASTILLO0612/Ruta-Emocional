import type { MentaAgentProvider, MentaAgentProviderRequest } from '../../application/ports';
import type {
  MentaAgentReply,
  MentaToolCode,
  MentaToolDeclaration,
} from '../../domain/mentaTypes';

interface GeminiInteractionResponse {
  readonly model?: unknown;
  readonly status?: unknown;
  readonly steps?: unknown;
}

const EMPTY_TOOL_CONTEXT_FIELD = '_request_context';

function providerCompatibleTools(
  tools: readonly MentaToolDeclaration[]
): readonly MentaToolDeclaration[] {
  return tools.map((tool) => Object.keys(tool.parameters.properties).length > 0
    ? tool
    : {
        ...tool,
        parameters: {
          type: 'object',
          properties: {
            [EMPTY_TOOL_CONTEXT_FIELD]: {
              type: 'string',
              description: 'Contexto opcional de la solicitud. No incluyas información adicional.',
            },
          },
        },
      });
}

function sanitizedToolArguments(
  value: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== EMPTY_TOOL_CONTEXT_FIELD)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSteps(response: GeminiInteractionResponse): readonly Record<string, unknown>[] {
  if (!Array.isArray(response.steps) || !response.steps.every(isRecord)) {
    throw new Error('Gemini returned an invalid interaction response');
  }
  return response.steps;
}

function outputText(steps: readonly Record<string, unknown>[]): string | null {
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step.type !== 'model_output' || !Array.isArray(step.content)) continue;
    const blocks = step.content.filter(isRecord);
    const text = blocks
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text as string)
      .join('\n')
      .trim();
    if (text) return text;
  }
  return null;
}

function functionCalls(
  steps: readonly Record<string, unknown>[],
  allowedTools: ReadonlySet<string>
): readonly {
  readonly id: string;
  readonly name: MentaToolCode;
  readonly argumentsValue: Readonly<Record<string, unknown>>;
}[] {
  return steps.flatMap((step) => {
    if (
      step.type !== 'function_call'
      || typeof step.id !== 'string'
      || typeof step.name !== 'string'
      || !allowedTools.has(step.name)
    ) {
      return [];
    }
    return [{
      id: step.id,
      name: step.name as MentaToolCode,
      argumentsValue: isRecord(step.arguments) ? step.arguments : {},
    }];
  });
}

function conversationInput(request: MentaAgentProviderRequest): Record<string, unknown>[] {
  const history = request.history.flatMap((turn) => [
    {
      type: 'user_input',
      content: [{ type: 'text', text: turn.userMessage }],
    },
    {
      type: 'model_output',
      content: [{ type: 'text', text: turn.assistantMessage }],
    },
  ]);
  return [
    ...history,
    {
      type: 'user_input',
      content: [{ type: 'text', text: request.message }],
    },
  ];
}

export class GeminiInteractionsMentaProvider implements MentaAgentProvider {
  constructor(private readonly options: {
    readonly apiKey: string;
    readonly model: string;
    readonly timeoutMs: number;
    readonly maximumToolRounds: number;
    readonly endpoint?: string;
    readonly fetchImplementation?: typeof fetch;
  }) {}

  async generateReply(request: MentaAgentProviderRequest): Promise<MentaAgentReply> {
    const input: Record<string, unknown>[] = conversationInput(request);
    const allowedTools = new Set(request.tools.map(({ name }) => name));
    const toolsUsed: MentaToolCode[] = [];
    let lastModelName = this.options.model;

    for (let round = 0; round <= this.options.maximumToolRounds; round += 1) {
      const response = await this.createInteraction(
        request.systemInstruction,
        input,
        request.tools
      );
      if (typeof response.model === 'string' && response.model.trim()) {
        lastModelName = response.model.trim();
      }
      const steps = readSteps(response);
      input.push(...steps);
      const calls = functionCalls(steps, allowedTools);
      if (calls.length === 0) {
        const text = outputText(steps);
        if (!text) throw new Error('Gemini did not return a text response');
        return {
          text,
          outcome: 'SUCCEEDED',
          modelName: lastModelName,
          toolsUsed: [...new Set(toolsUsed)],
        };
      }
      if (round === this.options.maximumToolRounds) {
        throw new Error('Gemini exceeded the maximum number of tool rounds');
      }

      for (const call of calls) {
        toolsUsed.push(call.name);
        let result: unknown;
        try {
          const execution = await request.executeTool(
            call.name,
            sanitizedToolArguments(call.argumentsValue)
          );
          result = execution.data;
        } catch {
          result = { error: 'La herramienta no está autorizada o no está disponible.' };
        }
        input.push({
          type: 'function_result',
          name: call.name,
          call_id: call.id,
          result: [{ type: 'text', text: JSON.stringify(result) }],
        });
      }
    }

    throw new Error('Gemini agent loop ended unexpectedly');
  }

  private async createInteraction(
    systemInstruction: string,
    input: readonly Record<string, unknown>[],
    tools: readonly MentaToolDeclaration[]
  ): Promise<GeminiInteractionResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await (this.options.fetchImplementation ?? fetch)(
        this.options.endpoint ?? 'https://generativelanguage.googleapis.com/v1beta/interactions',
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'x-goog-api-key': this.options.apiKey,
          },
          body: JSON.stringify({
            model: this.options.model,
            store: false,
            system_instruction: systemInstruction,
            input,
            tools: providerCompatibleTools(tools),
            generation_config: { temperature: 0.25, thinking_level: 'low' },
          }),
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        throw new Error(`Gemini request failed with status ${response.status}`);
      }
      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new Error('Gemini returned invalid JSON');
      return payload;
    } finally {
      clearTimeout(timeout);
    }
  }
}
