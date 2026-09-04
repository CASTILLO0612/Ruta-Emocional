/**
 * generateBudgetSuggestions — Genera chips de presupuesto dinámicos desde la política del backend.
 *
 * Principio rector: Cero montos o monedas hardcodeadas en componentes visuales.
 */
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
  // Si el rango es pequeño, divide en 3 puntos
  // Si es mayor, genera 4 puntos redondeados a decenas o centenas
  const stepCount = 4;
  const rawStep = range / (stepCount - 1);
  const roundFactor = rawStep >= 100 ? 50 : 10;

  const suggestions: number[] = [];
  for (let i = 0; i < stepCount; i++) {
    const rawValue = min + i * rawStep;
    const rounded = Math.round(rawValue / roundFactor) * roundFactor;
    // Asegurar que no quede por debajo del mínimo ni por encima del máximo
    const clamped = Math.min(max, Math.max(min, rounded));
    if (!suggestions.includes(clamped)) {
      suggestions.push(clamped);
    }
  }

  // Asegurar que al menos el mínimo esté presente
  if (!suggestions.includes(min)) {
    suggestions.unshift(min);
  }

  return suggestions.sort((a, b) => a - b);
}
