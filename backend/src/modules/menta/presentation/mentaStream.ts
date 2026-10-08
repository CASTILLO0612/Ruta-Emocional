import type { Response } from 'express';
import type { MentaTurnView } from '../domain/mentaTypes';

export type MentaStreamEvent = 'status' | 'delta' | 'replace' | 'completed' | 'error';

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function splitMentaStreamText(text: string): readonly string[] {
  return text.match(/\S+\s*/g) ?? [];
}

export function writeMentaStreamEvent(
  response: Response,
  event: MentaStreamEvent,
  payload: unknown
): boolean {
  if (response.writableEnded || response.destroyed) return false;
  response.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  return true;
}

export async function streamMentaTurn(
  response: Response,
  turn: MentaTurnView,
  chunkIntervalMs: number
): Promise<void> {
  for (const delta of splitMentaStreamText(turn.assistantMessage)) {
    if (!writeMentaStreamEvent(response, 'delta', { delta })) return;
    await delay(chunkIntervalMs);
  }
  writeMentaStreamEvent(response, 'completed', { turn });
}
