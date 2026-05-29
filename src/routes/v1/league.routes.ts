import { Router } from 'express';
import { leagueController } from '../../controllers/league.controller.js';

/**
 * League Routes — /api/v1/leagues
 *
 * Defines HTTP endpoints for league operations.
 * Each route maps directly to a controller method.
 */
const router = Router();

router
  .route('/')
  .get(leagueController.findAll)
  .post(leagueController.create);

router
  .route('/:id')
  .get(leagueController.findById)
  .put(leagueController.update)
  .delete(leagueController.delete);

export { router as leagueRouter };
