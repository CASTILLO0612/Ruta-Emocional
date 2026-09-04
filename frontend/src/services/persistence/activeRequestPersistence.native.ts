/**
 * Adaptador de persistencia de búsqueda activa — implementación nativa.
 *
 * Usa expo-secure-store (cifrado) para almacenar únicamente el activeRequestId
 * asociado al usuario autenticado. Nunca almacena datos clínicos, tokens ni payloads.
 *
 * Clave aislada por usuario: `ruta_active_req_${userId}`
 */
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
