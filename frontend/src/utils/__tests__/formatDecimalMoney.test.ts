import { formatDecimalMoney } from '../formatDecimalMoney';

describe('formatDecimalMoney', () => {
  it('formatea un decimal normalizado válido correctamente', () => {
    expect(formatDecimalMoney('600.00', 'C$')).toBe('C$ 600.00');
    expect(formatDecimalMoney('450.50', 'USD')).toBe('$ 450.50');
  });

  it('formatea un valor cero correctamente', () => {
    expect(formatDecimalMoney('0.00', 'C$')).toBe('C$ 0.00');
    expect(formatDecimalMoney('0', 'NIO')).toBe('C$ 0.00');
  });

  it('devuelve solo el código de moneda ante valores numéricos inválidos', () => {
    expect(formatDecimalMoney('invalido', 'C$')).toBe('C$');
    expect(formatDecimalMoney('', 'USD')).toBe('USD');
    expect(formatDecimalMoney('NaN', 'EUR')).toBe('EUR');
    expect(formatDecimalMoney('Infinity', 'NIO')).toBe('NIO');
  });

  it('soporta códigos de moneda admitidos por la plataforma como NIO', () => {
    expect(formatDecimalMoney('1200.00', 'NIO')).toBe('C$ 1,200.00');
  });
});
