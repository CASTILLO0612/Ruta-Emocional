import cors from 'cors';
import express, { Express } from 'express';
import { AppConfig } from './config/env';
import { Prisma, PrismaClient } from './generated/prisma/client';
import { ApplicationServices } from './compositionRoot';
import psychologistRoutes from './routes/psychologistRoutes';
import requestRoutes from './routes/requestRoutes';
import offerRoutes from './routes/offerRoutes';
import chatRoutes from './routes/chatRoutes';
import mentaRoutes from './routes/mentaRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { createIdentityRouter, createLegacyIdentityRouter } from './modules/identity/presentation/identityRoutes';
import { Logger } from './shared/infrastructure/logging/logger';
import { createCorsOptions } from './shared/presentation/http/corsOptions';
import { createErrorHandler, notFoundHandler } from './shared/presentation/http/errorHandler';
import { requestContext } from './shared/presentation/http/requestContext';
import { requestLogger } from './shared/presentation/http/requestLogger';
import { securityHeaders } from './shared/presentation/http/securityHeaders';
import { asyncHandler } from './shared/presentation/http/asyncHandler';

export interface AppDependencies {
  readonly config: AppConfig;
  readonly prisma: PrismaClient;
  readonly services: ApplicationServices;
  readonly logger: Logger;
}

async function withTimeout<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Readiness check timed out')), milliseconds);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createApp(dependencies: AppDependencies): Express {
  const { config, prisma, services, logger } = dependencies;
  const app = express();

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(requestContext);
  app.use(securityHeaders(config.environment));
  app.use(cors(createCorsOptions(config.allowedOrigins)));
  app.use(express.json({ limit: config.jsonBodyLimit, strict: true }));
  app.use(requestLogger(logger));

  app.get('/api/v1/health/live', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/v1/health/ready', asyncHandler(async (_request, response) => {
    try {
      await withTimeout(prisma.$queryRaw(Prisma.sql`SELECT 1 AS ok`), 2_000);
      response.json({ status: 'ok', checks: { database: 'ok' } });
    } catch {
      response.status(503).json({ status: 'degraded', checks: { database: 'unavailable' } });
    }
  }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'ruta-emocional-api' });
  });

  app.use('/api/v1/auth', createIdentityRouter(services.identity));
  app.use('/api/auth', createLegacyIdentityRouter(services.identity));

  if (config.legacyMongo.enabled) {
    app.use('/api/psychologists', psychologistRoutes);
    app.use('/api/requests', requestRoutes);
    app.use('/api/offers', offerRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/menta', mentaRoutes);
    app.use('/api/payments', paymentRoutes);
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
