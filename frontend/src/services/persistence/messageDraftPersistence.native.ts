import * as SecureStore from 'expo-secure-store';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'ruta-emocional.message-drafts',
};

function buildKey(userId: string, conversationId: string): string {
  return `ruta.message-draft.v1.${userId}.${conversationId}`;
}

export async function saveMessageDraft(
  userId: string,
  conversationId: string,
  value: string
): Promise<void> {
  if (!await SecureStore.isAvailableAsync()) return;
  await SecureStore.setItemAsync(buildKey(userId, conversationId), value, options);
}

export async function loadMessageDraft(
  userId: string,
  conversationId: string
): Promise<string | null> {
  if (!await SecureStore.isAvailableAsync()) return null;
  return SecureStore.getItemAsync(buildKey(userId, conversationId), options);
}

export async function clearMessageDraft(
  userId: string,
  conversationId: string
): Promise<void> {
  if (!await SecureStore.isAvailableAsync()) return;
  await SecureStore.deleteItemAsync(buildKey(userId, conversationId), options);
}
