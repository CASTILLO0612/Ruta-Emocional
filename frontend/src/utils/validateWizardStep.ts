/**
 * validateWizardStep — Validador puro por paso del asistente de creación de solicitud.
 *
 * Principio rector: El botón «Continuar» permanece deshabilitado hasta que
 * el paso actual cumpla con todos los criterios de validación.
 */
import type { Modality } from '../models/Psychologist';

export interface WizardDraft {
  readonly primaryNeed?: string;
  readonly description?: string;
  readonly modality?: Modality;
  readonly timing: 'immediate' | 'scheduled' | null;
  readonly scheduledFor?: Date;
  readonly proposedBudgetInput: string;
  readonly currencyCode?: string;
}

export interface BudgetLimits {
  readonly minimumAmount: number;
  readonly maximumAmount: number;
}

export function validateWizardStep(
  step: 1 | 2 | 3 | 4 | 5,
  draft: WizardDraft,
  limits?: BudgetLimits
): boolean {
  switch (step) {
    case 1:
      // Paso 1: Necesidad principal requerida (al menos 3 caracteres significativos)
      return Boolean(draft.primaryNeed && draft.primaryNeed.trim().length >= 3);

    case 2:
      // Paso 2: Modalidad válida seleccionada
      return Boolean(
        draft.modality && ['chat', 'call', 'in-person'].includes(draft.modality)
      );

    case 3:
      // Paso 3: Horario inmediato o programado con fecha válida
      if (draft.timing === 'immediate') return true;
      if (draft.timing === 'scheduled' && draft.scheduledFor) {
        return (
          !isNaN(draft.scheduledFor.getTime()) &&
          draft.scheduledFor.getTime() > Date.now() - 60000 // margen de 1 min
        );
      }
      return false;

    case 4: {
      // Paso 4: Presupuesto numérico válido dentro de los límites
      if (!limits || !draft.currencyCode) return false;
      const amount = Number(draft.proposedBudgetInput);
      if (!Number.isFinite(amount) || amount <= 0) return false;
      if (amount < limits.minimumAmount || amount > limits.maximumAmount) {
        return false;
      }
      return true;
    }

    case 5:
      // Paso 5 (Revisión): Todos los pasos anteriores deben ser válidos
      return (
        validateWizardStep(1, draft, limits) &&
        validateWizardStep(2, draft, limits) &&
        validateWizardStep(3, draft, limits) &&
        validateWizardStep(4, draft, limits)
      );

    default:
      return false;
  }
}
