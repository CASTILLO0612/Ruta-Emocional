/**
 * Convierte un decimal normalizado serializado (ej. "600.00") más un código de moneda
 * en un string de presentación localizado, reutilizando el formateador central.
 *
 * El snapshot de navegación guarda `amountDecimal` como string para mantener
 * serializabilidad. Esta utilidad es el único punto de conversión a formato
 * de presentación. Ningún componente debe convertir amountDecimal directamente.
 */
import { formatMoney } from './money';

export { formatMoney };

export function formatDecimalMoney(
  amountDecimal: string,
  currencyCode: string
): string {
  if (!amountDecimal || typeof amountDecimal !== 'string' || amountDecimal.trim() === '') {
    return currencyCode;
  }

  const amount = Number(amountDecimal);

  if (!Number.isFinite(amount)) {
    // Fallback seguro: muestra solo el código de moneda sin valor ambiguo
    return currencyCode;
  }

  return formatMoney(amount, currencyCode);
}
