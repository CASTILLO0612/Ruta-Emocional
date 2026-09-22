export interface MentaStreamChunk {
  readonly value: string;
  readonly remaining: string;
}

export function takeNextMentaStreamChunk(buffer: string): MentaStreamChunk | null {
  if (!buffer) return null;

  const word = buffer.match(/^\S+\s*/)?.[0];
  if (word) {
    return {
      value: word,
      remaining: buffer.slice(word.length),
    };
  }

  return {
    value: buffer.slice(0, 1),
    remaining: buffer.slice(1),
  };
}
