/**
 * Adaptador de persistencia de búsqueda activa — implementación web.
 *
 * Usa localStorage para almacenar únicamente el activeRequestId.
 * No existe cifrado equivalente a SecureStore en web, por lo que
 * solo se persiste el identificador opaco (sin datos clínicos ni tokens).
 *
 * Clave aislada por usuario: `ruta_active_req_${userId}`
 */

function buildKey(userId: string): string {
  return `ruta_active_req_${userId}`;
}

export async function saveActiveRequestId(
  userId: string,
  requestId: string
): Promise<void> {
  try {
    localStorage.setItem(buildKey(userId), requestId);
  } catch {
    // Storage puede no estar disponible (modo privado restrictivo)
  }
}

export async function loadActiveRequestId(
  userId: string
): Promise<string | null> {
  try {
    return localStorage.getItem(buildKey(userId));
  } catch {
    return null;
  }
}

export async function clearActiveRequestId(userId: string): Promise<void> {
  try {
    localStorage.removeItem(buildKey(userId));
  } catch {
    // Ignorar: si el item no existía, no hay acción necesaria
  }
}
