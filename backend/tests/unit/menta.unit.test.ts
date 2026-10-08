import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import type { AppConfig } from '../../src/config/env';
import type { AuthenticatedActor } from '../../src/modules/identity/application/identityService';
import { MentaService } from '../../src/modules/menta/application/mentaService';
import type {
  MentaAgentProvider,
  MentaAgentProviderRequest,
  MentaAuditContext,
  MentaContextGateway,
  MentaConversationRepository,
  MentaReplayedTurn,
  MentaStartedTurn,
} from '../../src/modules/menta/application/ports';
import type {
  MentaAgentReply,
  MentaConversationView,
  MentaScope,
  MentaToolCode,
  MentaToolExecution,
  MentaToolOutcome,
  MentaTurnView,
} from '../../src/modules/menta/domain/mentaTypes';
import { AppError } from '../../src/shared/domain/appError';
import { GeminiInteractionsMentaProvider } from '../../src/modules/menta/infrastructure/providers/geminiInteractionsMentaProvider';
import { OllamaMentaAgentProvider } from '../../src/modules/menta/infrastructure/providers/ollamaMentaAgentProvider';
import { splitMentaStreamText } from '../../src/modules/menta/presentation/mentaStream';
import { createTestConfig } from '../support/testConfig';

const userId = randomUUID();
const patientActor: AuthenticatedActor = {
  sessionId: randomUUID(),
  user: {
    id: userId,
    email: 'patient@example.test',
    displayName: 'Paciente de prueba',
    photoUrl: null,
    status: 'ACTIVE',
    roles: ['patient'],
    psychologistVerificationStatus: null,
    capabilities: ['menta:use:self'],
  },
};
const audit: MentaAuditContext = { actorUserId: userId, requestId: randomUUID() };

class MemoryConversationRepository implements MentaConversationRepository {
  conversation: MentaConversationView | null = null;
  readonly toolInvocations: { code: MentaToolCode; outcome: MentaToolOutcome }[] = [];

  async findOpenConversation(user: string, scope: MentaScope) {
    return user === userId && this.conversation?.scope === scope ? this.conversation : null;
  }

  async createOrFindOpenConversation(
    _user: string,
    scope: MentaScope,
    consentVersion: string,
    _audit: MentaAuditContext
  ) {
    this.conversation ??= {
      id: randomUUID(),
      scope,
      consentVersion,
      consentedAt: new Date().toISOString(),
      turns: [],
    };
    return this.conversation;
  }

  async requireOwnedConversation(user: string, conversationId: string) {
    if (user !== userId || this.conversation?.id !== conversationId) {
      throw AppError.notFound('MENTA_CONVERSATION_NOT_FOUND');
    }
    return this.conversation;
  }

  async restartConversation(
    user: string,
    conversationId: string,
    scope: MentaScope,
    consentVersion: string,
    _audit: MentaAuditContext
  ) {
    await this.requireOwnedConversation(user, conversationId);
    this.conversation = {
      id: randomUUID(),
      scope,
      consentVersion,
      consentedAt: new Date().toISOString(),
      turns: [],
    };
    return this.conversation;
  }

  async startTurn(
    _user: string,
    _conversationId: string,
    _clientMessageId: string,
    _message: string,
    _historyLimit: number,
    _audit: MentaAuditContext
  ): Promise<MentaStartedTurn | MentaReplayedTurn> {
    return {
      kind: 'STARTED',
      turnId: randomUUID(),
      history: this.conversation?.turns.map((turn) => ({
        userMessage: turn.userMessage,
        assistantMessage: turn.assistantMessage,
      })) ?? [],
    };
  }

  async completeTurn(
    _user: string,
    _turnId: string,
    reply: MentaAgentReply,
    _audit: MentaAuditContext
  ): Promise<MentaTurnView> {
    const now = new Date().toISOString();
    const turn: MentaTurnView = {
      id: randomUUID(),
      clientMessageId: randomUUID(),
      userMessage: 'mensaje de prueba',
      assistantMessage: reply.text,
      providerOutcome: reply.outcome,
      modelName: reply.modelName,
      toolsUsed: reply.toolsUsed,
      createdAt: now,
      completedAt: now,
    };
    if (this.conversation) {
      this.conversation = { ...this.conversation, turns: [...this.conversation.turns, turn] };
    }
    return turn;
  }

  async failTurn(): Promise<void> {}

  async recordToolInvocation(
    _turnId: string,
    toolCode: MentaToolCode,
    outcome: MentaToolOutcome
  ): Promise<void> {
    this.toolInvocations.push({ code: toolCode, outcome });
  }
}

class RecordingContextGateway implements MentaContextGateway {
  readonly calls: MentaToolCode[] = [];

  async execute(
    _actor: AuthenticatedActor,
    _scope: MentaScope,
    toolCode: MentaToolCode
  ): Promise<MentaToolExecution> {
    this.calls.push(toolCode);
    return { data: { appointments: [] }, resourceType: 'appointment', resourceCount: 0 };
  }
}

class ToolCallingProvider implements MentaAgentProvider {
  calls = 0;

  async generateReply(request: MentaAgentProviderRequest): Promise<MentaAgentReply> {
    this.calls += 1;
    await request.executeTool('get_my_agenda', {});
    return {
      text: 'No tienes citas próximas registradas.',
      outcome: 'SUCCEEDED',
      modelName: 'test-model',
      toolsUsed: ['get_my_agenda'],
    };
  }
}

function enabledConfig(): { menta: AppConfig['menta']; triage: AppConfig['triage'] } {
  const config = createTestConfig('postgresql://test:test@example.test/test', 'menta-unit');
  return {
    triage: config.triage,
    menta: {
      ...config.menta,
      enabled: true,
      provider: 'GEMINI',
      providerGovernanceApproved: true,
      geminiApiKey: 'test-api-key-with-at-least-thirty-two-characters',
    },
  };
}

test('MENTA resolves an agenda request without waiting for an external provider', async () => {
  const conversations = new MemoryConversationRepository();
  const context = new RecordingContextGateway();
  const provider = new ToolCallingProvider();
  const config = enabledConfig();
  const service = new MentaService(conversations, context, provider, config.menta, config.triage);

  const conversation = await service.openConversation(patientActor, 'PATIENT', true, audit);
  const turn = await service.sendMessage(
    patientActor,
    conversation.id,
    randomUUID(),
    '¿Cuándo es mi próxima cita?',
    audit
  );

  assert.equal(turn.providerOutcome, 'NOT_USED');
  assert.equal(provider.calls, 0);
  assert.match(turn.assistantMessage, /No tienes citas próximas/i);
  assert.deepEqual(context.calls, ['get_my_agenda']);
  assert.deepEqual(conversations.toolInvocations, [{ code: 'get_my_agenda', outcome: 'SUCCEEDED' }]);
});

test('MENTA intercepts an immediate safety signal before calling an external provider', async () => {
  const conversations = new MemoryConversationRepository();
  const provider = new ToolCallingProvider();
  const config = enabledConfig();
  const service = new MentaService(
    conversations,
    new RecordingContextGateway(),
    provider,
    config.menta,
    config.triage
  );
  const conversation = await service.openConversation(patientActor, 'PATIENT', true, audit);

  const turn = await service.sendMessage(
    patientActor,
    conversation.id,
    randomUUID(),
    'No quiero vivir y necesito ayuda',
    audit
  );

  assert.equal(provider.calls, 0);
  assert.equal(turn.providerOutcome, 'NOT_USED');
  assert.match(turn.assistantMessage, /seguridad/i);
  assert.match(turn.assistantMessage, /emergencia/i);
});

test('MENTA rejects a scope that does not belong to the authenticated role', () => {
  const config = enabledConfig();
  const service = new MentaService(
    new MemoryConversationRepository(),
    new RecordingContextGateway(),
    new ToolCallingProvider(),
    config.menta,
    config.triage
  );

  assert.throws(
    () => service.openConversation(patientActor, 'PSYCHOLOGIST', true, audit),
    (error: unknown) => error instanceof AppError && error.code === 'MENTA_SCOPE_NOT_AVAILABLE'
  );
});

test('MENTA restarts an owned conversation without carrying its previous turns', async () => {
  const conversations = new MemoryConversationRepository();
  const config = enabledConfig();
  const service = new MentaService(
    conversations,
    new RecordingContextGateway(),
    new ToolCallingProvider(),
    config.menta,
    config.triage
  );
  const current = await service.openConversation(patientActor, 'PATIENT', true, audit);
  conversations.conversation = {
    ...current,
    turns: [{
      id: randomUUID(),
      clientMessageId: randomUUID(),
      userMessage: 'Mensaje anterior',
      assistantMessage: 'Respuesta anterior',
      providerOutcome: 'SUCCEEDED',
      modelName: 'test-model',
      toolsUsed: [],
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    }],
  };

  const restarted = await service.restartConversation(patientActor, current.id, audit);

  assert.notEqual(restarted.id, current.id);
  assert.deepEqual(restarted.turns, []);
  assert.equal(restarted.scope, 'PATIENT');
});

test('Gemini adapter executes a no-argument tool in stateless mode without leaking its compatibility field', async () => {
  const payloads: Record<string, unknown>[] = [];
  let call = 0;
  let toolArguments: Readonly<Record<string, unknown>> | null = null;
  const fetchImplementation: typeof fetch = async (_input, init) => {
    payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    call += 1;
    return new Response(JSON.stringify(call === 1
      ? {
          model: 'gemini-test',
          status: 'requires_action',
          steps: [{
            type: 'function_call',
            id: 'call-1',
            name: 'get_my_agenda',
            arguments: { _request_context: 'agenda' },
          }],
        }
      : {
          model: 'gemini-test',
          status: 'completed',
          steps: [{
            type: 'model_output',
            content: [{ type: 'text', text: 'No tienes citas próximas.' }],
          }],
        }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const provider = new GeminiInteractionsMentaProvider({
    apiKey: 'test-key',
    model: 'gemini-test',
    timeoutMs: 1_000,
    maximumToolRounds: 2,
    fetchImplementation,
  });

  const response = await provider.generateReply({
    systemInstruction: 'Usa herramientas.',
    history: [],
    message: 'Consulta mi agenda.',
    tools: [{
      type: 'function',
      name: 'get_my_agenda',
      description: 'Consulta agenda propia.',
      parameters: { type: 'object', properties: {} },
    }],
    executeTool: async (_code, argumentsValue) => {
      toolArguments = argumentsValue;
      return { data: { appointments: [] }, resourceType: 'appointment', resourceCount: 0 };
    },
  });

  assert.equal(response.outcome, 'SUCCEEDED');
  assert.deepEqual(response.toolsUsed, ['get_my_agenda']);
  assert.deepEqual(toolArguments, {});
  assert.equal(payloads.every((payload) => payload.store === false), true);
  const providerTools = payloads[0].tools as { parameters: { properties: Record<string, unknown> } }[];
  assert.ok(providerTools[0].parameters.properties._request_context);
});

test('Ollama adapter executes an authorized tool and returns the final local response', async () => {
  const payloads: Record<string, unknown>[] = [];
  let call = 0;
  let toolArguments: Readonly<Record<string, unknown>> | null = null;
  const fetchImplementation: typeof fetch = async (_input, init) => {
    payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    call += 1;
    return new Response(JSON.stringify(call === 1
      ? {
          model: 'local-test',
          message: {
            role: 'assistant',
            content: '',
            tool_calls: [{ function: { name: 'get_my_agenda', arguments: {} } }],
          },
        }
      : {
          model: 'local-test',
          message: { role: 'assistant', content: 'No tienes citas próximas.' },
        }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const provider = new OllamaMentaAgentProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'local-test',
    timeoutMs: 1_000,
    maximumToolRounds: 2,
    keepAlive: '10m',
    maximumHistoryCharacters: 6_000,
    maximumOutputTokens: 128,
    toolCallingEnabled: true,
    fetchImplementation,
  });

  const response = await provider.generateReply({
    systemInstruction: 'Usa herramientas cuando sean necesarias.',
    history: [],
    message: 'Consulta mi agenda.',
    tools: [{
      type: 'function',
      name: 'get_my_agenda',
      description: 'Consulta la agenda propia.',
      parameters: { type: 'object', properties: {} },
    }],
    executeTool: async (_code, argumentsValue) => {
      toolArguments = argumentsValue;
      return { data: { appointments: [] }, resourceType: 'appointment', resourceCount: 0 };
    },
  });

  assert.equal(response.outcome, 'SUCCEEDED');
  assert.equal(response.modelName, 'local-test');
  assert.deepEqual(response.toolsUsed, ['get_my_agenda']);
  assert.deepEqual(toolArguments, {});
  assert.equal(payloads.length, 2);
  assert.equal(payloads.every((payload) => payload.stream === false), true);
  assert.deepEqual(payloads[0].options, { temperature: 0.2, num_predict: 128 });
});

test('Ollama adapter confines conversation history to its configured local context budget', async () => {
  const payloads: Record<string, unknown>[] = [];
  const fetchImplementation: typeof fetch = async (_input, init) => {
    payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(JSON.stringify({
      model: 'local-test',
      message: { role: 'assistant', content: 'Respuesta breve.' },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const provider = new OllamaMentaAgentProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'local-test',
    timeoutMs: 1_000,
    maximumToolRounds: 1,
    keepAlive: '10m',
    maximumHistoryCharacters: 40,
    maximumOutputTokens: 96,
    toolCallingEnabled: false,
    fetchImplementation,
  });

  await provider.generateReply({
    systemInstruction: 'Responde de forma breve.',
    history: [
      { userMessage: 'a'.repeat(50), assistantMessage: 'A'.repeat(50) },
      { userMessage: 'b'.repeat(50), assistantMessage: 'B'.repeat(50) },
    ],
    message: 'Hola.',
    tools: [],
    executeTool: async () => ({ data: {}, resourceType: 'none', resourceCount: 0 }),
  });

  const messages = payloads[0].messages as { role: string; content: string }[];
  const history = messages.slice(1, -1);
  assert.ok(history.reduce((total, message) => total + message.content.length, 0) <= 40);
  assert.equal(history.some((message) => message.content.includes('b')), true);
  assert.equal(history.some((message) => message.content.includes('a')), false);
});

test('Ollama adapter forwards native response fragments while the local model is generating', async () => {
  const payloads: Record<string, unknown>[] = [];
  const fetchImplementation: typeof fetch = async (_input, init) => {
    payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    const body = [
      JSON.stringify({ model: 'local-test', message: { role: 'assistant', content: 'Respuesta ' } }),
      JSON.stringify({ model: 'local-test', message: { role: 'assistant', content: 'en curso.' }, done: true }),
    ].join('\n');
    return new Response(`${body}\n`, {
      status: 200,
      headers: { 'content-type': 'application/x-ndjson' },
    });
  };
  const provider = new OllamaMentaAgentProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'local-test',
    timeoutMs: 1_000,
    maximumToolRounds: 1,
    keepAlive: '10m',
    maximumHistoryCharacters: 2_000,
    maximumOutputTokens: 96,
    toolCallingEnabled: false,
    fetchImplementation,
  });
  const deltas: string[] = [];

  const response = await provider.generateReply({
    systemInstruction: 'Responde de forma breve.',
    history: [],
    message: 'Hola.',
    tools: [],
    executeTool: async () => ({ data: {}, resourceType: 'none', resourceCount: 0 }),
  }, {
    onTextDelta: (delta) => deltas.push(delta),
  });

  assert.equal(payloads[0].stream, true);
  assert.deepEqual(deltas, ['Respuesta ', 'en curso.']);
  assert.equal(response.text, 'Respuesta en curso.');
});

test('MENTA streaming preserves the validated response while separating readable tokens', () => {
  const message = '### Próxima cita\n- **Martes:** 10:00 a. m.\n- Modalidad: Chat';
  const chunks = splitMentaStreamText(message);

  assert.equal(chunks.join(''), message);
  assert.ok(chunks.length > 1);
  assert.equal(chunks[0], '### ');
});
