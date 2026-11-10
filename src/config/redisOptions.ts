import type { RedisOptions } from 'ioredis';
import { logger } from './logger.js';

/**
 * Cache and rate-limit client options.
 *
 * The client does not connect until the first command, and a command gives up
 * instead of waiting out a sleeping Redis. Callers fail open. Reconnects
 * continue in the background so a Redis that wakes later starts working
 * without a process restart.
 */
export function cacheRedisOptions(): RedisOptions {
  return {
    maxRetriesPerRequest: 1,
    connectTimeout: 1_000,
    commandTimeout: 1_500,
    lazyConnect: true,
    retryStrategy(times: number): number {
      const delay = Math.min(times * 200, 5_000);
      if (times === 1 || times % 10 === 0) {
        logger.warn({ attempt: times, delayMs: delay }, 'Redis: reconnecting');
      }
      return delay;
    },
  };
}
