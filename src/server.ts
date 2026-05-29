import { app } from './app.js';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { disconnectDatabase } from './config/database.js';
import { disconnectRedis } from './config/redis.js';

/**
 * Server entry point.
 *
 * Starts the HTTP server and registers signal handlers for
 * graceful shutdown to ensure:
 * - Active connections are allowed to finish
 * - Database connections are properly closed
 * - Redis connections are properly closed
 * - Resources are cleaned up before process exit
 */
const server = app.listen(config.PORT, () => {
  logger.info(
    {
      port: config.PORT,
      env: config.NODE_ENV,
      pid: process.pid,
    },
    `🚀 Server running on http://localhost:${config.PORT}`,
  );
  logger.info(`📚 API docs: http://localhost:${config.PORT}/api/v1`);
  logger.info(`❤️  Health check: http://localhost:${config.PORT}/health`);
});

/* ── Graceful Shutdown ───────────────────────────────────── */

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function gracefulShutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Received shutdown signal, starting graceful shutdown');

  // Force kill after timeout to prevent zombie processes
  const forceKillTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  // Prevent the timeout from keeping the process alive
  forceKillTimer.unref();

  try {
    // 1. Stop accepting new connections
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
    logger.info('HTTP server closed');

    // 2. Disconnect database
    await disconnectDatabase();

    // 3. Disconnect Redis
    await disconnectRedis();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});

/* ── Unhandled Errors ────────────────────────────────────── */

process.on('unhandledRejection', (reason: unknown) => {
  logger.fatal({ err: reason }, 'Unhandled Promise Rejection — shutting down');
  void gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err }, 'Uncaught Exception — shutting down');
  void gracefulShutdown('uncaughtException');
});

export { server };
