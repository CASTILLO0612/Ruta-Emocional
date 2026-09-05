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
  }
}
