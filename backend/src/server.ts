import http from 'http';
import { Server as SocketServer } from 'socket.io';
import { createApp } from './app';
import { buildApplicationServices } from './compositionRoot';
import { loadConfig, loadEnvironmentFile } from './config/env';
import { getPrismaClient } from './shared/infrastructure/database/prismaClient';
import { createLogger } from './shared/infrastructure/logging/logger';
import { setupSockets } from './sockets/socketHandler';
import { MessageOutboxDispatcher } from './modules/messaging/infrastructure/outbox/messageOutboxDispatcher';

export async function startServer(): Promise<void> {
  loadEnvironmentFile();
  const config = loadConfig();
  const logger = createLogger(config.environment);
  const prisma = getPrismaClient(config.databaseUrl);

  await prisma.$connect();
  logger.info('database.postgresql.connected');

  const services = buildApplicationServices(config, prisma);
  const app = createApp({ config, prisma, services, logger });
  const server = http.createServer(app);

  const io = new SocketServer(server, {
    cors: {
      origin: [...config.allowedOrigins],
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: 16 * 1024,
    serveClient: false,
  });
  const realtimePublisher = setupSockets(
    io,
    services.identity,
    services.messaging,
    logger,
    config.messaging
  );
  const messageOutbox = new MessageOutboxDispatcher(
    prisma,
    services.messaging,
    realtimePublisher,
    logger,
    config.messaging
  );

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.port, () => resolve());
  });
  messageOutbox.start();
  logger.info('server.started', { port: config.port });

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('server.shutdown_started', { signal });
    messageOutbox.stop();

    const forceExit = setTimeout(() => {
      logger.error('server.shutdown_timed_out');
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    await new Promise<void>((resolve) => io.close(() => resolve()));
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    await prisma.$disconnect();
    clearTimeout(forceExit);
    logger.info('server.shutdown_completed');
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

if (require.main === module) {
  void startServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown startup failure';
    process.stderr.write(`${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'ruta-emocional-api',
      message: 'server.startup_failed',
      error: { name: error instanceof Error ? error.name : 'UnknownError', message },
    })}\n`);
    process.exitCode = 1;
  });
}
