/**
 * ActiveRequestPersistence — Contrato del adaptador multiplataforma.
 *
 * En tiempo de compilación Metro resuelve automáticamente:
 * - `.native.ts` en iOS / Android (usando expo-secure-store)
 * - `.web.ts` en navegadores web (usando localStorage)
 */
export async function saveActiveRequestId(
  userId: string,
  requestId: string
): Promise<void> {
  // Implementación fallback por defecto
  return Promise.resolve();
}

export async function loadActiveRequestId(
  userId: string
): Promise<string | null> {
  return Promise.resolve(null);
}

export async function clearActiveRequestId(userId: string): Promise<void> {
  return Promise.resolve();
}
