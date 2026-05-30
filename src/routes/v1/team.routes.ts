import { Router } from 'express';
import { teamController } from '../../controllers/team.controller.js';
import { cacheMiddleware } from '../../middleware/cache.js';

const router = Router();

// Cache list for 5 minutes
router
  .route('/')
  .get(cacheMiddleware(300, 'teams'), teamController.findAll)
  .post(teamController.create);

// Cache individual team for 10 minutes
router
  .route('/:id')
  .get(cacheMiddleware(600, 'teams'), teamController.findById)
  .put(teamController.update)
  .delete(teamController.delete);

export { router as teamRouter };
