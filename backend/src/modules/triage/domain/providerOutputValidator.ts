import { TRIAGE_MODALITIES, TriageModality } from './triageTypes';

export class TriageProviderOutputError extends Error {
  constructor() {
    super('The external triage provider returned an unsafe or invalid payload');
    this.name = 'TriageProviderOutputError';
  }
}

const PROHIBITED_CLINICAL_CLAIMS = /\b(diagn[oó]stic(?:o|a|os|as)?|prescrib(?:ir|e|imos|en|i[oó])?|medicament(?:o|os)?|garantiz(?:ar|a|amos|an|ado)?|contactamos\s+(?:a\s+)?(?:emergencias|polic[ií]a)|we\s+contacted\s+emergency)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ValidatedProviderOrientation {
  readonly summary: string;
  readonly recommendedModalities: readonly TriageModality[];
}

export function validateProviderOrientation(
  value: unknown,
  allowedModalities: readonly TriageModality[],
  maximumSummaryLength: number
): ValidatedProviderOrientation {
  if (!isRecord(value)) throw new TriageProviderOutputError();
  if (Object.keys(value).some((key) => key !== 'summary' && key !== 'recommendedModalities')) {
    throw new TriageProviderOutputError();
  }
  const summary = typeof value.summary === 'string' ? value.summary.trim() : '';
  if (!summary || summary.length > maximumSummaryLength || PROHIBITED_CLINICAL_CLAIMS.test(summary)) {
    throw new TriageProviderOutputError();
  }
  if (!Array.isArray(value.recommendedModalities) || value.recommendedModalities.length < 1) {
    throw new TriageProviderOutputError();
  }
  const modalities = value.recommendedModalities;
  if (modalities.some((modality) => (
    typeof modality !== 'string'
    || !TRIAGE_MODALITIES.includes(modality as TriageModality)
    || !allowedModalities.includes(modality as TriageModality)
  ))) {
    throw new TriageProviderOutputError();
  }
  const unique = [...new Set(modalities as TriageModality[])];
  if (unique.length !== modalities.length) throw new TriageProviderOutputError();
  return { summary, recommendedModalities: unique };
}
