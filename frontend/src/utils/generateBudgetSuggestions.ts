export interface BudgetPolicyInput {
  readonly minimumAmount: number;
  readonly maximumAmount: number;
}

export function generateBudgetSuggestions(policy: BudgetPolicyInput): number[] {
  const min = Math.max(0, policy.minimumAmount);
  const max = Math.max(min, policy.maximumAmount);

  if (min === max) {
    return [min];
  }

  const range = max - min;
  const stepCount = 4;
  const rawStep = range / (stepCount - 1);
  const roundFactor = rawStep >= 100 ? 50 : 10;

  const suggestions: number[] = [];
  for (let i = 0; i < stepCount; i++) {
    const rawValue = min + i * rawStep;
    const rounded = Math.round(rawValue / roundFactor) * roundFactor;
    const clamped = Math.min(max, Math.max(min, rounded));
    if (!suggestions.includes(clamped)) {
      suggestions.push(clamped);
    }
  }

  if (!suggestions.includes(min)) {
    suggestions.unshift(min);
  }

  return suggestions.sort((a, b) => a - b);
}
