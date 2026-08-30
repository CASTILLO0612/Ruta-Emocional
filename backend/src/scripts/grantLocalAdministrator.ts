import { loadConfig, loadEnvironmentFile } from '../config/env';
import { UserRoleAssignmentStatus } from '../generated/prisma/client';
import { getPrismaClient } from '../shared/infrastructure/database/prismaClient';

function canonicalEmail(value: string | undefined): string {
  const email = value?.trim().toLowerCase() ?? '';
  if (email.length < 3 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Provide one valid account email as the first argument.');
  }
  return email;
}

export async function grantLocalAdministrator(emailArgument: string | undefined): Promise<void> {
  loadEnvironmentFile();
  const config = loadConfig();
  if (!config.localQa.enabled || config.environment !== 'development') {
    throw new Error('Local administrator provisioning requires ENABLE_LOCAL_QA in development.');
  }

  const email = canonicalEmail(emailArgument);
  const prisma = getPrismaClient(config.databaseUrl);
  await prisma.$connect();
  try {
    await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { email }, select: { id: true } });
      if (!user) throw new Error('The account does not exist. Register it before granting the role.');
      const role = await transaction.role.findUnique({
        where: { code: 'administrator' },
        select: { id: true },
      });
      if (!role) throw new Error('The administrator role is not available. Apply database migrations first.');

      const activeAssignment = await transaction.userRole.findFirst({
        where: {
          userId: user.id,
          roleId: role.id,
          status: UserRoleAssignmentStatus.ACTIVE,
        },
        select: { id: true },
      });
      if (!activeAssignment) {
        await transaction.userRole.create({ data: { userId: user.id, roleId: role.id } });
      }
      await transaction.auditEvent.create({
        data: {
          action: 'local_qa.administrator_granted',
          resourceType: 'user',
          resourceId: user.id,
          metadata: { source: 'grantLocalAdministrator' },
        },
      });
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void grantLocalAdministrator(process.argv[2])
    .then(() => process.stdout.write('Local administrator role granted. Sign in again to refresh capabilities.\n'))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Local administrator provisioning failed.';
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
