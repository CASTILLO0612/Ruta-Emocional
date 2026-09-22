import * as SecureStore from 'expo-secure-store';

import type { WizardDraft } from '../../utils/validateWizardStep';
import {
  decodeRequestWizardDraft,
  encodeRequestWizardDraft,
} from '../../utils/requestWizardDraftCodec';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'ruta-emocional.request-drafts',
};

function buildKey(userId: string): string {
  return `ruta.request-draft.v1.${userId}`;
}

export async function saveRequestWizardDraft(userId: string, draft: WizardDraft): Promise<void> {
  if (!await SecureStore.isAvailableAsync()) return;
  await SecureStore.setItemAsync(buildKey(userId), encodeRequestWizardDraft(draft), options);
}

export async function loadRequestWizardDraft(userId: string): Promise<WizardDraft | null> {
  if (!await SecureStore.isAvailableAsync()) return null;
  return decodeRequestWizardDraft(await SecureStore.getItemAsync(buildKey(userId), options));
}

export async function clearRequestWizardDraft(userId: string): Promise<void> {
  if (!await SecureStore.isAvailableAsync()) return;
  await SecureStore.deleteItemAsync(buildKey(userId), options);
}
