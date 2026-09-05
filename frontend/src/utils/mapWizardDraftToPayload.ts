import type { CreateRequestPayload } from '../repositories/RequestRepository';
import type { WizardDraft } from './validateWizardStep';

export function mapWizardDraftToPayload(draft: WizardDraft): CreateRequestPayload {
  if (!draft.modality) {
    throw new Error('La modalidad es obligatoria para crear una solicitud.');
  }
  if (!draft.currencyCode) {
    throw new Error('La moneda debe provenir de la configuración de solicitudes.');
  }

  const budget = Number(draft.proposedBudgetInput);
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error('El presupuesto propuesto debe ser un número positivo.');
  }

  return {
    modality: draft.modality,
    proposedBudget: budget,
    currencyCode: draft.currencyCode,
    ...(draft.primaryNeed?.trim() ? { primaryNeed: draft.primaryNeed.trim() } : {}),
    ...(draft.description?.trim() ? { description: draft.description.trim() } : {}),
    ...(draft.timing === 'scheduled' && draft.scheduledFor
      ? { scheduledFor: draft.scheduledFor }
      : {}),
  };
}
