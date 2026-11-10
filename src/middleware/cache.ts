import { type Request, type Response, type NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

/**
 * A body is an error envelope when the API reports failure.
 * Those must never be stored: the cache only keeps the JSON body, so a
 * cached 500 would later be replayed with Express's default status 200.
 */
export function isErrorResponseBody(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;

  const record = body as { success?: unknown; error?: unknown };
  if (record.success === false) return true;

  return 'error' in record && record.error != null && typeof record.error === 'object';
}

/**
 * Only 2xx payloads that are not error envelopes are safe to store.
 */
export function shouldStoreResponse(statusCode: number, body: unknown): boolean {
  return statusCode >= 200 && statusCode < 300 && !isErrorResponseBody(body);
}

/**
 * Redis cache middleware factory.
 *
 * Intercepts GET requests and checks Redis for a cached response.
 * If found, returns the cached data immediately. If not, the response
 * is intercepted and stored in Redis for subsequent requests.
 *
 * Error responses are not stored. A previously stored error envelope is
 * deleted and treated as a miss so visitors never receive it as HTTP 200.
 *
 * @param ttlSeconds - Time-to-live for cached entries in seconds (default: 300 = 5 minutes)
 * @param keyPrefix - Prefix for cache keys to namespace by resource type
 *
 * @example
 * ```ts
 * // Cache league list for 10 minutes
 * router.get('/leagues', cacheMiddleware(600, 'leagues'), leagueController.findAll);
 *
 * // Cache individual match for 30 seconds (live data)
 * router.get('/matches/:id', cacheMiddleware(30, 'match'), matchController.findById);
 * ```
 */
export const cacheMiddleware = (ttlSeconds = 300, keyPrefix = 'cache') => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    const cacheKey = `${keyPrefix}:${req.originalUrl}`;

    try {
      const cached = await redis.get(cacheKey);

      if (cached) {
        const parsed: unknown = JSON.parse(cached);

        if (!isErrorResponseBody(parsed)) {
          logger.debug({ cacheKey }, 'Cache HIT');
          res.setHeader('X-Cache', 'HIT');
          res.json(parsed);
          return;
        }

        logger.warn({ cacheKey }, 'Discarding cached error response');
        await redis.del(cacheKey);
      }

      logger.debug({ cacheKey }, 'Cache MISS');
      res.setHeader('X-Cache', 'MISS');

      // Intercept the response to cache it. Error payloads are not stored:
      // a cached 404 would keep hiding a record after it is created.
      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        if (shouldStoreResponse(res.statusCode, body)) {
          redis.setex(cacheKey, ttlSeconds, JSON.stringify(body)).catch((err: unknown) => {
            logger.error({ err, cacheKey }, 'Failed to write to cache');
          });
        }

        return originalJson(body);
      }) as Response['json'];

      next();
    } catch (err) {
      // Cache errors should never break the request — log and continue
      logger.error({ err, cacheKey }, 'Cache middleware error');
      next();
    }
  };
};

/**
 * Invalidate cache entries by pattern.
 *
 * @example
 * ```ts
 * // Invalidate all league cache entries
 * await invalidateCache('leagues:*');
 * ```
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info({ pattern, count: keys.length }, 'Cache invalidated');
    }
  } catch (err) {
    logger.error({ err, pattern }, 'Cache invalidation error');
  }
}
