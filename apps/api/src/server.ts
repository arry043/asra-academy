import { API_PREFIX, SHUTDOWN_TIMEOUT_MS } from './config/constants.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { disconnectPrisma } from './lib/prisma.js';
import { connectRedis, disconnectRedis } from './lib/redis.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    `ASRA Academy API listening on http://localhost:${env.PORT}${API_PREFIX} (${env.NODE_ENV})`,
  );
});

server.on('error', (error) => {
  logger.fatal({ err: error }, 'HTTP server failed to start');
  process.exit(1);
});

void connectRedis();

let shuttingDown = false;

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`${signal} received — shutting down gracefully`);

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    // Stop accepting new connections, let in-flight requests finish, then drop idle keep-alives.
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeIdleConnections();
    });
    await Promise.allSettled([disconnectPrisma(), disconnectRedis()]);
    logger.info('Shutdown complete');
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    exitCode = 1;
  }
  process.exit(exitCode);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  void shutdown('uncaughtException', 1);
});
