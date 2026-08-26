import { PrismaClient } from '../../../generated/prisma/client';

let prismaInstance: PrismaClient | undefined;

export function getPrismaClient(databaseUrl?: string): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      ...(databaseUrl
        ? {
            datasources: {
              db: { url: databaseUrl },
            },
          }
        : {}),
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (!prismaInstance) return;
  await prismaInstance.$disconnect();
  prismaInstance = undefined;
}
