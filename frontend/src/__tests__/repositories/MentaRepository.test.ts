import { parseMentaServerSentEvent } from '../../repositories/MentaRepository';

describe('MentaRepository streaming', () => {
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
});
