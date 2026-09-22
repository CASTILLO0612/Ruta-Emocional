const drafts = new Map<string, string>();

function buildKey(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`;
}

export async function saveMessageDraft(
  userId: string,
  conversationId: string,
  value: string
): Promise<void> {
  drafts.set(buildKey(userId, conversationId), value);
}

export async function loadMessageDraft(
  userId: string,
  conversationId: string
): Promise<string | null> {
  return drafts.get(buildKey(userId, conversationId)) ?? null;
}

export async function clearMessageDraft(
  userId: string,
  conversationId: string
): Promise<void> {
  drafts.delete(buildKey(userId, conversationId));
}
