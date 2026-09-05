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
    return currencyCode;
  }

  return formatMoney(amount, currencyCode);
}
