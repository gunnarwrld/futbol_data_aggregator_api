import { Router } from 'express';
import { teamController } from '../../controllers/team.controller.js';
import { cacheMiddleware } from '../../middleware/cache.js';
import { requireApiKey } from '../../middleware/requireApiKey.js';

const router = Router();

// Cache list for 5 minutes
router
  .route('/')
  .get(cacheMiddleware(300, 'teams'), teamController.findAll)
  .post(requireApiKey, teamController.create);

// Cache individual team for 10 minutes
router
  .route('/:id')
  .get(cacheMiddleware(600, 'teams'), teamController.findById)
  .put(requireApiKey, teamController.update)
  .delete(requireApiKey, teamController.delete);

export { router as teamRouter };
