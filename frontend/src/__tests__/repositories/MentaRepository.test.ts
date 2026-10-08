import * as apiClient from '../../services/apiClient';
import {
  parseMentaServerSentEvent,
  restartMentaConversation,
  sendMentaMessageStream,
} from '../../repositories/MentaRepository';

describe('MentaRepository streaming', () => {
  afterEach(() => jest.restoreAllMocks());

  it('interpreta eventos SSE completos sin perder el contenido de cada delta', () => {
    expect(parseMentaServerSentEvent('event: delta\ndata: {"delta":"Hola "}\n\n')).toEqual({
      event: 'delta',
      data: { delta: 'Hola ' },
    });
  });

  it('ignora tramas incompletas y rechaza datos no interpretables', () => {
    expect(parseMentaServerSentEvent('event: delta\n\n')).toBeNull();
    expect(() => parseMentaServerSentEvent('event: delta\ndata: {\n\n')).toThrow(
      'La respuesta de MENTA no pudo interpretarse.'
    );
  });

  it('interpreta el reemplazo seguro de una respuesta validada', () => {
    expect(parseMentaServerSentEvent('event: replace\ndata: {"text":"Respuesta validada"}\n\n')).toEqual({
      event: 'replace',
      data: { text: 'Respuesta validada' },
    });
  });

  it('entrega deltas nativos y conserva el turno validado al completar el stream', async () => {
    const turn = {
      id: 'turn-1',
      clientMessageId: 'client-1',
      userMessage: 'Hola',
      assistantMessage: 'Hola de vuelta',
      providerOutcome: 'SUCCEEDED' as const,
      modelName: 'local-test',
      toolsUsed: [],
      createdAt: '2026-09-23T00:00:00.000Z',
      completedAt: '2026-09-23T00:00:01.000Z',
    };
    const frames = [
      'event: delta\ndata: {"delta":"Hola "}',
      'event: delta\ndata: {"delta":"de vuelta"}',
      `event: completed\ndata: ${JSON.stringify({ turn })}`,
    ].join('\n\n');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`${frames}\n\n`));
        controller.close();
      },
    });
    jest.spyOn(apiClient, 'apiV1EventStream').mockResolvedValue(stream);
    const deltas: string[] = [];

    const completed = await sendMentaMessageStream(
      'conversation-1',
      'client-1',
      'Hola',
      { onDelta: (delta) => deltas.push(delta) }
    );

    expect(deltas).toEqual(['Hola ', 'de vuelta']);
    expect(completed).toEqual(turn);
  });

  it('reinicia la conversación mediante una ruta autenticada dedicada', async () => {
    const restarted = {
      id: 'conversation-2',
      scope: 'PATIENT' as const,
      consentVersion: '1.0.0',
      consentedAt: '2026-09-25T00:00:00.000Z',
      turns: [],
    };
    const request = jest.spyOn(apiClient, 'apiV1Request').mockResolvedValue({ data: restarted });

    await expect(restartMentaConversation('conversation/1')).resolves.toEqual(restarted);
    expect(request).toHaveBeenCalledWith(
      '/menta/conversations/conversation%2F1/restart',
      'POST'
    );
  });
});
