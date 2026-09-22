import type { WizardDraft } from './validateWizardStep';

interface StoredRequestWizardDraft {
  readonly version: 1;
  readonly primaryNeed: string;
  readonly description: string;
  readonly modality: WizardDraft['modality'];
  readonly timing: WizardDraft['timing'];
  readonly scheduledFor: string | null;
  readonly proposedBudgetInput: string;
  readonly currencyCode: string | null;
}

export function encodeRequestWizardDraft(draft: WizardDraft): string {
  const stored: StoredRequestWizardDraft = {
    version: 1,
    primaryNeed: draft.primaryNeed ?? '',
    description: draft.description ?? '',
    modality: draft.modality,
    timing: draft.timing,
    scheduledFor: draft.scheduledFor?.toISOString() ?? null,
    proposedBudgetInput: draft.proposedBudgetInput,
    currencyCode: draft.currencyCode ?? null,
  };
  return JSON.stringify(stored);
}

export function decodeRequestWizardDraft(value: string | null): WizardDraft | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value) as Partial<StoredRequestWizardDraft>;
    if (candidate.version !== 1) return null;
    if (typeof candidate.primaryNeed !== 'string' || typeof candidate.description !== 'string') {
      return null;
    }
    if (!candidate.modality || !['chat', 'call', 'in-person'].includes(candidate.modality)) {
      return null;
    }
    if (!candidate.timing || !['immediate', 'scheduled'].includes(candidate.timing)) return null;
    if (typeof candidate.proposedBudgetInput !== 'string') return null;
    if (candidate.currencyCode !== null && typeof candidate.currencyCode !== 'string') return null;
    const scheduledFor = candidate.scheduledFor ? new Date(candidate.scheduledFor) : undefined;
    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) return null;

    return {
      primaryNeed: candidate.primaryNeed,
      description: candidate.description,
      modality: candidate.modality,
      timing: candidate.timing,
      scheduledFor,
      proposedBudgetInput: candidate.proposedBudgetInput,
      currencyCode: candidate.currencyCode ?? undefined,
    };
  } catch {
    return null;
  }
}
