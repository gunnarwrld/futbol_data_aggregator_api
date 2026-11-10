import Redis from 'ioredis';
import { config } from './index.js';
import { logger } from './logger.js';
import { cacheRedisOptions } from './redisOptions.js';

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
export const redis = new Redis.default(config.REDIS_URL, cacheRedisOptions());

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
  // quit() connects first when the client is still lazy. A sleeping Redis
  // would then stall shutdown. Drop the socket unless it is already usable.
  if (redis.status === 'ready') {
    await redis.quit();
  } else {
    redis.disconnect();
  }
  logger.info('Redis connection closed');
}
