export function formatMoney(amount: number, currencyCode: string): string {
  if (!Number.isFinite(amount)) return currencyCode;
  return `${currencyCode} ${amount.toFixed(2)}`;
}
