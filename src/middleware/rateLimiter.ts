import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * Global rate limiter middleware.
 *
 * Limits the number of requests per IP address within a configurable
 * time window. Returns a standardized AppError response on limit exceeded.
 *
 * Configuration via environment variables:
 * - `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds (default: 15 minutes)
 * - `RATE_LIMIT_MAX_REQUESTS`: Max requests per window (default: 100)
 *
 * TODO: Upgrade to Redis-backed store for distributed rate limiting
 * when running multiple instances behind a load balancer.
 */
export const rateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests('Too many requests, please try again later'));
  },
  message: {
    success: false,
    error: {
      message: 'Too many requests, please try again later',
      code: 'TOO_MANY_REQUESTS',
      statusCode: 429,
    },
  },
  keyGenerator: (req) => {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  },
});

/**
 * Stricter rate limiter for sensitive endpoints (e.g., auth, data sync).
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests('Rate limit exceeded for this endpoint'));
  },
  keyGenerator: (req) => {
    return req.ip ?? req.socket.remoteAddress ?? 'unknown';
  },
});
