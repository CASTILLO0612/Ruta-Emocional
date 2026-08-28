import cors from 'cors';
import express, { Express } from 'express';
import { AppConfig } from './config/env';
import { Prisma, PrismaClient } from './generated/prisma/client';
import { ApplicationServices } from './compositionRoot';
import psychologistRoutes from './routes/psychologistRoutes';
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
import { createProfessionalDirectoryRouter } from './modules/professional-directory/presentation/professionalDirectoryRoutes';
import { createServiceRequestRouter } from './modules/service-request/presentation/serviceRequestRoutes';
import { createMessagingRouter } from './modules/messaging/presentation/messagingRoutes';

export interface AppDependencies {
  readonly config: AppConfig;
  readonly prisma: PrismaClient;
  readonly services: ApplicationServices;
  readonly logger: Logger;
}

interface OutboxReadinessRow {
  readonly deadLettered: boolean;
  readonly lagging: boolean;
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
      const lagCutoff = new Date(
        Date.now() - config.messaging.outboxReadinessMaximumLagSeconds * 1000
      );
      const [outbox] = await withTimeout(prisma.$queryRaw<OutboxReadinessRow[]>(Prisma.sql`
        SELECT
          EXISTS (
            SELECT 1
              FROM "outbox_events"
             WHERE "event_type" IN (
               'message.created',
               'psychologist.verification_approved',
               'psychologist.verification_rejected'
             )
               AND "dead_lettered_at" IS NOT NULL
          ) AS "deadLettered",
          EXISTS (
            SELECT 1
              FROM "outbox_events"
             WHERE "event_type" IN (
               'message.created',
               'psychologist.verification_approved',
               'psychologist.verification_rejected'
             )
               AND "published_at" IS NULL
               AND "dead_lettered_at" IS NULL
               AND "occurred_at" < ${lagCutoff}
          ) AS "lagging"
      `), 2_000);
      const messagingOutbox = outbox?.deadLettered
        ? 'dead-lettered-events'
        : outbox?.lagging
          ? 'lagging'
          : 'ok';
      const status = messagingOutbox === 'ok' ? 'ok' : 'degraded';
      response.status(status === 'ok' ? 200 : 503).json({
        status,
        checks: { database: 'ok', messagingOutbox },
      });
    } catch {
      response.status(503).json({
        status: 'degraded',
        checks: { database: 'unavailable', messagingOutbox: 'unknown' },
      });
    }
  }));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'ruta-emocional-api' });
  });

  app.use('/api/v1/auth', createIdentityRouter(services.identity));
  app.use(
    '/api/v1',
    createProfessionalDirectoryRouter(
      services.identity,
      services.professionalDirectory,
      config.professionalDirectory,
      config.localQa
    )
  );
  app.use(
    '/api/v1',
    createMessagingRouter(services.identity, services.messaging, config.messaging)
  );
  app.use(
    '/api/v1',
    createServiceRequestRouter(
      services.identity,
      services.serviceRequests,
      config.requestFlow
    )
  );
  app.use('/api/auth', createLegacyIdentityRouter(services.identity));

  if (config.legacyMongo.enabled) {
    app.use('/api/psychologists', psychologistRoutes);
    app.use('/api/menta', mentaRoutes);
    app.use('/api/payments', paymentRoutes);
  }

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
