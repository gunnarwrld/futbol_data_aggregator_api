import { Router } from 'express';
import { apiKeyController } from '../../controllers/apiKey.controller.js';
import { strictRateLimiter } from '../../middleware/rateLimiter.js';

/**
 * API Key Management Routes.
 *
 * These endpoints allow consumers to provision and manage their API keys.
 * Key creation is protected by the strict rate limiter to prevent abuse.
 *
 * Routes:
 * - POST   /api/v1/api-keys          → Generate a new API key
 * - GET    /api/v1/api-keys          → List all API keys
 * - PATCH  /api/v1/api-keys/:id/revoke → Revoke an API key
 */
const router = Router();

router.post('/', strictRateLimiter, apiKeyController.create);
router.get('/', apiKeyController.list);
router.patch('/:id/revoke', apiKeyController.revoke);

export { router as apiKeyRouter };
