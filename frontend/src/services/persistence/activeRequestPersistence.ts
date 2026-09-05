export async function saveActiveRequestId(
  userId: string,
  requestId: string
): Promise<void> {
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
