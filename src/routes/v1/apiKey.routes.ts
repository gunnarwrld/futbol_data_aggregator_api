import { Router } from 'express';
import { apiKeyController } from '../../controllers/apiKey.controller.js';
import { requireApiKey } from '../../middleware/requireApiKey.js';
import { strictRateLimiter } from '../../middleware/rateLimiter.js';

/**
 * API Key Management Routes.
 *
 * Listing, creating, and revoking keys requires an existing valid API key.
 * Key creation is also protected by the strict rate limiter.
 * Mint the first key with `npm run admin:create-key`.
 *
 * Routes:
 * - POST   /api/v1/api-keys          → Generate a new API key
 * - GET    /api/v1/api-keys          → List all API keys
 * - PATCH  /api/v1/api-keys/:id/revoke → Revoke an API key
 */
const router = Router();

router.post('/', requireApiKey, strictRateLimiter, (req, res, next) => {
  apiKeyController.create(req, res, next).catch(next);
});
router.get('/', requireApiKey, (req, res, next) => {
  apiKeyController.list(req, res, next).catch(next);
});
router.patch('/:id/revoke', requireApiKey, (req, res, next) => {
  apiKeyController.revoke(req, res, next).catch(next);
});

export { router as apiKeyRouter };
