import { type Request, type Response, type NextFunction } from 'express';
import { apiKeyService } from '../services/apiKey.service.js';
import { logger } from '../config/logger.js';

/**
 * Augment Express Request to carry the authenticated API key context.
 */
declare global {
  namespace Express {
    interface Request {
      apiKey?: {
        id: string;
        name: string;
        tier: string;
        rateLimit: number;
      };
    }
  }
}

/**
 * API Key Authentication Middleware.
 *
 * Extracts the `x-api-key` header, validates it against the database,
 * and attaches the key's metadata to `req.apiKey`.
 *
 * Behavior:
 * ─────────
 * - If NO key is provided → request continues as unauthenticated
 *   (rate limited at 50 req/hr by the sliding window limiter)
 * - If an INVALID/EXPIRED/REVOKED key is provided → 401 Unauthorized
 * - If a VALID key is provided → `req.apiKey` is populated
 *   (rate limited at the key's configured limit, default 1000 req/hr)
 *
 * This is NOT a gate — unauthenticated requests are allowed through.
 * The rate limiter downstream uses `req.apiKey` to decide the tier.
 */
export async function authenticateApiKey(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const rawKey = req.headers['x-api-key'];

  // No key provided — continue as unauthenticated (anonymous tier)
  if (!rawKey || typeof rawKey !== 'string') {
    next();
    return;
  }

  try {
    const apiKey = await apiKeyService.validate(rawKey);

    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: {
          message: 'Invalid, expired, or revoked API key',
          code: 'INVALID_API_KEY',
          statusCode: 401,
        },
      });
      return;
    }

    // Attach key metadata to the request for downstream middleware
    req.apiKey = {
      id: apiKey.id,
      name: apiKey.name,
      tier: apiKey.tier,
      rateLimit: apiKey.rateLimit,
    };

    logger.debug(
      { apiKeyId: apiKey.id, tier: apiKey.tier },
      'API key authenticated',
    );

    next();
  } catch (err) {
    logger.error({ err }, 'API key authentication error');
    next();
  }
}
