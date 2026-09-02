const MODALITY_LABELS: Readonly<Record<string, string>> = {
  CHAT: 'Chat',
  CALL: 'Llamada',
  IN_PERSON: 'Presencial',
  chat: 'Chat',
  call: 'Llamada',
  video: 'Video',
  'in-person': 'Presencial',
};

export function formatModalityLabel(modality: string): string {
  return MODALITY_LABELS[modality] ?? modality;
}
