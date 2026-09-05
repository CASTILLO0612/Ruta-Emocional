import { APP_LOCALE } from '../config/localization';

export function formatCurrencySymbol(currencyCode: string): string {
  const normalizedCurrencyCode = currencyCode.trim().toUpperCase();

  try {
    return new Intl.NumberFormat(APP_LOCALE, {
      style: 'currency',
      currency: normalizedCurrencyCode,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0).find((part) => part.type === 'currency')?.value
      ?? normalizedCurrencyCode;
  } catch {
    return currencyCode;
  }
}

export function formatMoney(amount: number, currencyCode: string): string {
  if (!Number.isFinite(amount)) return currencyCode;

  const normalizedCurrencyCode = currencyCode.trim().toUpperCase();

  try {
    const parts = new Intl.NumberFormat(APP_LOCALE, {
      style: 'currency',
      currency: normalizedCurrencyCode,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(amount);
    const symbol = formatCurrencySymbol(normalizedCurrencyCode);
    const value = parts
      .filter((part) => part.type !== 'currency' && part.type !== 'literal')
      .map((part) => part.value)
      .join('');

    return `${symbol} ${value}`;
  } catch {
    return `${currencyCode} ${amount.toFixed(2)}`;
  }
}
