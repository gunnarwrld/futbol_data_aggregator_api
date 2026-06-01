import { type Request, type Response, type NextFunction } from 'express';
import { apiKeyService } from '../services/apiKey.service.js';
import { AppError } from '../utils/AppError.js';

/**
 * API Key Controller.
 *
 * Handles HTTP request/response for API key lifecycle operations.
 * All business logic is delegated to apiKeyService.
 */
export const apiKeyController = {
  /**
   * POST /api/v1/api-keys
   * Generate a new API key.
   *
   * ⚠️  The raw key is returned ONCE in this response.
   * It cannot be recovered — only the SHA-256 hash is stored.
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, tier, rateLimit, expiresAt } = req.body as {
        name?: string;
        tier?: 'standard' | 'premium';
        rateLimit?: number;
        expiresAt?: string;
      };

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw AppError.badRequest('A "name" field is required to identify the API key');
      }

      const result = await apiKeyService.create({
        name: name.trim(),
        tier,
        rateLimit,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      res.status(201).json({
        success: true,
        data: {
          rawKey: result.rawKey,
          apiKey: result.apiKey,
        },
        meta: {
          warning:
            'Store the rawKey securely — it will NOT be shown again. Only the hashed version is stored.',
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/api-keys
   * List all API keys (hashed keys are excluded).
   */
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const keys = await apiKeyService.list();

      res.status(200).json({
        success: true,
        data: keys,
        meta: { total: keys.length },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/v1/api-keys/:id/revoke
   * Revoke an API key (soft delete — sets isActive to false).
   */
  async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        throw AppError.badRequest('API key ID is required');
      }

      const revokedKey = await apiKeyService.revoke(id);

      res.status(200).json({
        success: true,
        data: {
          id: revokedKey.id,
          name: revokedKey.name,
          prefix: revokedKey.prefix,
          isActive: revokedKey.isActive,
        },
        meta: { message: 'API key has been revoked' },
      });
    } catch (err) {
      next(err);
    }
  },
};
