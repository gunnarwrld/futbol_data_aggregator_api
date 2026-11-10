import { Router } from 'express';
import { leagueController } from '../../controllers/league.controller.js';
import { cacheMiddleware } from '../../middleware/cache.js';
import { requireApiKey } from '../../middleware/requireApiKey.js';

/**
 * League Routes — /api/v1/leagues
 */
const router = Router();

// Cache list for 5 minutes
router
  .route('/')
  .get(cacheMiddleware(300, 'leagues'), leagueController.findAll)
  .post(requireApiKey, leagueController.create);

// Cache individual league for 10 minutes
router
  .route('/:id')
  .get(cacheMiddleware(600, 'leagues'), leagueController.findById)
  .put(requireApiKey, leagueController.update)
  .delete(requireApiKey, leagueController.delete);

export { router as leagueRouter };
