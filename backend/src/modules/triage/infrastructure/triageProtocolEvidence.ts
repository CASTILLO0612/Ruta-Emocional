import { AppConfig } from '../../../config/env';
import { PrismaClient } from '../../../generated/prisma/client';
import {
  buildTriageProtocolArtifact,
  hashTriageProtocolArtifact,
} from '../domain/triageProtocolArtifact';
import { PrismaTriageRepository } from './persistence/prismaTriageRepository';

export class TriageProtocolEvidenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TriageProtocolEvidenceError';
  }
}

export async function getCurrentTriageProtocolArtifact(
  prisma: PrismaClient,
  policy: AppConfig['triage'],
  now: Date = new Date()
) {
  const definition = await new PrismaTriageRepository(prisma).getDefinition(
    policy.consentDocumentCode,
    policy.consentDocumentVersion,
    now
  );
  const artifact = buildTriageProtocolArtifact(definition, policy);
  return { artifact, artifactSha256: hashTriageProtocolArtifact(artifact) };
}

export async function assertTriageProtocolEvidence(
  prisma: PrismaClient,
  policy: AppConfig['triage']
): Promise<void> {
  const evidence = policy.protocolApproval;
  if (!evidence) {
    throw new TriageProtocolEvidenceError('MENTA protocol approval evidence is missing');
  }
  const current = await getCurrentTriageProtocolArtifact(prisma, policy);
  if (current.artifactSha256 !== evidence.artifactSha256.toLowerCase()) {
    throw new TriageProtocolEvidenceError(
      'MENTA protocol approval hash does not match the active database and safety messages'
    );
  }
}
