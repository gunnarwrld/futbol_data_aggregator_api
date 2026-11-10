import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from './index.js';
import { logger } from './logger.js';

/**
 * Singleton Prisma client instance.
 *
 * In development, the client is attached to `globalThis` to prevent
 * multiple instances from being created during hot-reloading.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Bound the first connection so a sleeping Railway Postgres fails fast enough
// for a single retry, instead of hanging until the platform proxy gives up.
const DATABASE_CONNECTION_TIMEOUT_MS = 10_000;

// Initialize the database connection pool using the pg driver
const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS,
});
const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      config.NODE_ENV === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'error', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' },
          ]
        : [{ level: 'error', emit: 'stdout' }],
  });

if (config.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma on shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  // The pg pool is external and is not closed by Prisma unless
  // disposeExternalPool is set. Close it so shutdown and tests release it.
  await pool.end();
  logger.info('Database connection closed');
}
