import { takeNextMentaStreamChunk } from '../mentaStreamPresentation';

describe('takeNextMentaStreamChunk', () => {
  it('libera una palabra con el espacio posterior para preservar el texto original', () => {
    expect(takeNextMentaStreamChunk('Hola mundo')).toEqual({
      value: 'Hola ',
      remaining: 'mundo',
    });
  });

  it('conserva texto Markdown y saltos de línea al reconstruir la respuesta', () => {
    let remaining = '### Agenda\n- Revisa tu próxima cita';
    let result = '';
    let next = takeNextMentaStreamChunk(remaining);

    while (next) {
      result += next.value;
      remaining = next.remaining;
      next = takeNextMentaStreamChunk(remaining);
    }

    expect(result).toBe('### Agenda\n- Revisa tu próxima cita');
  });

  it('devuelve null cuando no quedan caracteres por mostrar', () => {
    expect(takeNextMentaStreamChunk('')).toBeNull();
  });
});
