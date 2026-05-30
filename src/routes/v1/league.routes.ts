import { Router } from 'express';
import { leagueController } from '../../controllers/league.controller.js';
import { cacheMiddleware } from '../../middleware/cache.js';

/**
 * League Routes — /api/v1/leagues
 */
const router = Router();

// Cache list for 5 minutes
router
  .route('/')
  .get(cacheMiddleware(300, 'leagues'), leagueController.findAll)
  .post(leagueController.create);

// Cache individual league for 10 minutes
router
  .route('/:id')
  .get(cacheMiddleware(600, 'leagues'), leagueController.findById)
  .put(leagueController.update)
  .delete(leagueController.delete);

export { router as leagueRouter };
