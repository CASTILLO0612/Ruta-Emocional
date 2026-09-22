export const MotionDuration = {
  fast: 180,
  normal: 260,
  slow: 320,
} as const;

export const StreamingCadence = {
  mentaWord: 48,
} as const;

export const PersistenceCadence = {
  messageDraft: 320,
  requestDraft: 420,
} as const;

export const Motion = {
  duration: MotionDuration,
  persistence: PersistenceCadence,
  streaming: StreamingCadence,
  subtleScale: 0.98,
} as const;
