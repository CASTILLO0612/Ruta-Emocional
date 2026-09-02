import cors from 'cors';
import express, { Express } from 'express';
import { AppConfig } from './config/env';
import { Prisma, PrismaClient } from './generated/prisma/client';
import { ApplicationServices } from './compositionRoot';
import { createIdentityRouter } from './modules/identity/presentation/identityRoutes';
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
import { createAppointmentRouter } from './modules/appointment/presentation/appointmentRoutes';
import { createClinicalRecordRouter } from './modules/clinical-record/presentation/clinicalRecordRoutes';
import { createTriageRouter } from './modules/triage/presentation/triageRoutes';
import { createMentaRouter } from './modules/menta/presentation/mentaRoutes';

export interface AppDependencies {
  readonly config: AppConfig;
  readonly prisma: PrismaClient;
  readonly services: ApplicationServices;
  readonly logger: Logger;
}

interface OutboxReadinessRow {
  readonly deadLettered: boolean;
  readonly lagging: boolean;
  readonly overduePrivacyRequests: boolean;
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
               'psychologist.verification_rejected',
               'appointment.created',
               'appointment.updated',
               'appointment.rescheduled',
               'appointment.reminder_due'
             )
               AND "dead_lettered_at" IS NOT NULL
          ) AS "deadLettered",
          EXISTS (
            SELECT 1
              FROM "outbox_events"
             WHERE "event_type" IN (
               'message.created',
               'psychologist.verification_approved',
               'psychologist.verification_rejected',
               'appointment.created',
               'appointment.updated',
               'appointment.rescheduled',
               'appointment.reminder_due'
             )
               AND "published_at" IS NULL
               AND "dead_lettered_at" IS NULL
               AND "available_at" < ${lagCutoff}
          ) AS "lagging",
          EXISTS (
            SELECT 1
              FROM "triage_erasure_requests"
             WHERE "status" IN ('BLOCKED', 'UNDER_REVIEW')
               AND "due_at" < CURRENT_TIMESTAMP
          ) AS "overduePrivacyRequests"
      `), 2_000);
      const messagingOutbox = outbox?.deadLettered
        ? 'dead-lettered-events'
        : outbox?.lagging
          ? 'lagging'
          : 'ok';
      const privacyRequests = outbox?.overduePrivacyRequests ? 'overdue' : 'ok';
      const status = messagingOutbox === 'ok' && privacyRequests === 'ok'
        ? 'ok'
        : 'degraded';
      response.status(status === 'ok' ? 200 : 503).json({
        status,
        checks: { database: 'ok', messagingOutbox, privacyRequests },
      });
    } catch {
      response.status(503).json({
        status: 'degraded',
        checks: {
          database: 'unavailable',
          messagingOutbox: 'unknown',
          privacyRequests: 'unknown',
        },
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
  app.use(
    '/api/v1',
    createAppointmentRouter(services.identity, services.appointments, config.appointments)
  );
  app.use(
    '/api/v1',
    createClinicalRecordRouter(services.identity, services.clinicalRecords, config.clinical)
  );
  app.use(
    '/api/v1',
    createTriageRouter(services.identity, services.triage, config.triage)
  );
  app.use(
    '/api/v1',
    createMentaRouter(services.identity, services.menta, config.menta)
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
