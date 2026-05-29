import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from './logger.js';

/**
 * Redis client with automatic reconnection strategy and structured logging.
 *
 * Connection events are logged at appropriate levels:
 * - `connect`: info
 * - `ready`: info
 * - `error`: error
 * - `close`: warn
 * - `reconnecting`: warn
 */
export const redis = new Redis.default(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times: number): number | null {
    if (times > 10) {
      logger.error('Redis: max reconnection attempts exceeded');
      return null; // Stop retrying
    }
    const delay = Math.min(times * 200, 5000);
    logger.warn({ attempt: times, delayMs: delay }, 'Redis: reconnecting');
    return delay;
  },
  lazyConnect: false,
});

redis.on('connect', () => {
  logger.info('Redis: connected');
});

redis.on('ready', () => {
  logger.info('Redis: ready to accept commands');
});

redis.on('error', (err: Error) => {
  logger.error({ err }, 'Redis: connection error');
});

redis.on('close', () => {
  logger.warn('Redis: connection closed');
});

/**
 * Gracefully disconnect Redis on shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
  logger.info('Redis connection closed');
}
