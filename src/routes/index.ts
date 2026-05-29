import { Router } from 'express';
import { v1Router } from './v1/index.js';

/**
 * API Router — mounts versioned API routes.
 *
 * Current versions:
 * - /api/v1 — Active
 *
 * New versions can be added here without breaking existing consumers.
 */
const router = Router();

router.use('/v1', v1Router);

export { router as apiRouter };
