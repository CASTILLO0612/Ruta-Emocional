import type { WizardDraft } from '../../utils/validateWizardStep';
import {
  decodeRequestWizardDraft,
  encodeRequestWizardDraft,
} from '../../utils/requestWizardDraftCodec';

const drafts = new Map<string, string>();

export async function saveRequestWizardDraft(userId: string, draft: WizardDraft): Promise<void> {
  drafts.set(userId, encodeRequestWizardDraft(draft));
}

export async function loadRequestWizardDraft(userId: string): Promise<WizardDraft | null> {
  return decodeRequestWizardDraft(drafts.get(userId) ?? null);
}

export async function clearRequestWizardDraft(userId: string): Promise<void> {
  drafts.delete(userId);
}
