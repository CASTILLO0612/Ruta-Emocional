import { createHash } from 'node:crypto';
import { TriageDefinition } from './triageTypes';

export const TRIAGE_AUTOMATED_NOTICE =
  'MENTA es un sistema automatizado de orientación y siempre se identifica como tal.';
export const TRIAGE_EMERGENCY_DISCLAIMER =
  'MENTA no es un servicio de emergencia, no realiza diagnósticos y no contacta servicios de emergencia por ti.';

export interface TriageProtocolArtifactPolicy {
  readonly evaluatorVersion: string;
  readonly externalProviderEnabled: boolean;
  readonly safetyActions: Readonly<Record<'HIGH' | 'CRITICAL', readonly string[]>>;
}

export function buildTriageProtocolArtifact(
  definition: TriageDefinition,
  policy: TriageProtocolArtifactPolicy
) {
  return {
    evaluatorVersion: policy.evaluatorVersion,
    externalProviderEnabled: policy.externalProviderEnabled,
    automatedSystemNotice: TRIAGE_AUTOMATED_NOTICE,
    emergencyDisclaimer: TRIAGE_EMERGENCY_DISCLAIMER,
    consentDocument: {
      code: definition.consentDocument.code,
      version: definition.consentDocument.version,
      title: definition.consentDocument.title,
      content: definition.consentDocument.content,
      contentHash: definition.consentDocument.contentHash,
    },
    questions: definition.questions,
    needs: definition.needs,
    rules: definition.rules,
    safetyActions: policy.safetyActions,
  } as const;
}

export function hashTriageProtocolArtifact(
  artifact: unknown
): string {
  return createHash('sha256').update(JSON.stringify(artifact), 'utf8').digest('hex');
}
