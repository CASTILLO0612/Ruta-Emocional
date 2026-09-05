import * as SecureStore from 'expo-secure-store';

function buildKey(userId: string): string {
  return `ruta_active_req_${userId}`;
}

export async function saveActiveRequestId(
  userId: string,
  requestId: string
): Promise<void> {
  await SecureStore.setItemAsync(buildKey(userId), requestId);
}

export async function loadActiveRequestId(
  userId: string
): Promise<string | null> {
  return SecureStore.getItemAsync(buildKey(userId));
}

export async function clearActiveRequestId(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(buildKey(userId));
}
