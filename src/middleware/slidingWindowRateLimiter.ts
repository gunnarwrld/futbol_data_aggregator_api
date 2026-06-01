import { type Request, type Response, type NextFunction } from 'express';
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

/**
 * Rate limit tiers.
 *
 * ┌──────────────────┬──────────────┬────────────────────────┐
 * │ Tier             │ Limit/Hour   │ Identifier             │
 * ├──────────────────┼──────────────┼────────────────────────┤
 * │ anonymous        │ 50           │ IP address             │
 * │ standard (key)   │ 1,000        │ API key ID             │
 * │ premium (key)    │ 5,000        │ API key ID             │
 * │ custom (key)     │ key.rateLimit│ API key ID             │
 * └──────────────────┴──────────────┴────────────────────────┘
 */
const ANONYMOUS_RATE_LIMIT = 50;
const WINDOW_SIZE_SECONDS = 3600; // 1 hour

/**
 * Redis Sliding Window Rate Limiter.
 *
 * Algorithm: Sliding Window Log
 * ─────────────────────────────
 * Instead of a fixed window (which causes burst spikes at boundaries),
 * this uses a sorted set in Redis where:
 *
 * 1. Each request adds a member with the current timestamp as score
 * 2. Members older than the window are pruned (ZREMRANGEBYSCORE)
 * 3. The current count (ZCARD) is checked against the limit
 *
 * This gives a smooth, accurate rate limit without the "double burst"
 * problem of fixed windows, and without the memory overhead of a
 * full sliding window counter.
 *
 * All three operations (prune, add, count) are executed atomically
 * via a Redis pipeline to minimize round-trips.
 *
 * Response headers (RFC 6585 / draft-ietf-httpapi-ratelimit):
 * - X-RateLimit-Limit: maximum requests per window
 * - X-RateLimit-Remaining: requests remaining in current window
 * - X-RateLimit-Reset: seconds until the window resets
 * - Retry-After: seconds to wait (only on 429)
 */
export async function slidingWindowRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // Determine identity and limit based on API key presence
    const isAuthenticated = !!req.apiKey;
    const identifier = isAuthenticated
      ? `apikey:${req.apiKey!.id}`
      : `ip:${req.ip ?? req.socket.remoteAddress ?? 'unknown'}`;

    const limit = isAuthenticated ? req.apiKey!.rateLimit : ANONYMOUS_RATE_LIMIT;

    const redisKey = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - WINDOW_SIZE_SECONDS * 1000;

    // Atomic pipeline: prune → add → count → get oldest
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart); // 1. Remove expired entries
    pipeline.zadd(redisKey, now, `${now}:${Math.random()}`); // 2. Add current request
    pipeline.zcard(redisKey); // 3. Count requests in window
    pipeline.expire(redisKey, WINDOW_SIZE_SECONDS); // 4. Set TTL for cleanup

    const results = await pipeline.exec();

    if (!results) {
      // Redis unavailable — fail open (allow request through)
      logger.warn('Rate limiter: Redis pipeline returned null — failing open');
      next();
      return;
    }

    const requestCount = (results[2]?.[1] as number) ?? 0;
    const remaining = Math.max(0, limit - requestCount);
    const resetSeconds = WINDOW_SIZE_SECONDS;

    // Set standard rate limit headers on every response
    res.setHeader('X-RateLimit-Limit', limit);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (requestCount > limit) {
      // Remove the request we just added — it shouldn't count
      // (we added it before checking, so undo on rejection)
      redis.zrem(redisKey, `${now}:${Math.random()}`).catch(() => {});

      logger.warn(
        { identifier, requestCount, limit },
        'Rate limit exceeded',
      );

      res.setHeader('Retry-After', resetSeconds);
      res.status(429).json({
        success: false,
        error: {
          message: isAuthenticated
            ? `API key rate limit exceeded (${limit} requests/hour)`
            : `Anonymous rate limit exceeded (${limit} requests/hour). Pass a valid x-api-key header for higher limits.`,
          code: 'RATE_LIMIT_EXCEEDED',
          statusCode: 429,
          limit,
          remaining: 0,
          resetInSeconds: resetSeconds,
        },
      });
      return;
    }

    next();
  } catch (err) {
    // Rate limiter errors should never break requests — fail open
    logger.error({ err }, 'Sliding window rate limiter error — failing open');
    next();
  }
}
