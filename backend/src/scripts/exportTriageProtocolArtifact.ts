import { loadConfig, loadEnvironmentFile } from '../config/env';
import { getCurrentTriageProtocolArtifact } from '../modules/triage/infrastructure/triageProtocolEvidence';
import { getPrismaClient } from '../shared/infrastructure/database/prismaClient';

async function run(): Promise<void> {
  loadEnvironmentFile();
  const config = loadConfig();
  const prisma = getPrismaClient(config.databaseUrl);
  try {
    await prisma.$connect();
    const result = await getCurrentTriageProtocolArtifact(prisma, config.triage);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown export failure';
  process.stderr.write(`Could not export MENTA protocol artifact: ${message}\n`);
  process.exitCode = 1;
});
