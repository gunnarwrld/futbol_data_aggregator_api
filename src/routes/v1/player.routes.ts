import { Router } from 'express';
import { playerController } from '../../controllers/player.controller.js';
import { cacheMiddleware } from '../../middleware/cache.js';
import { requireApiKey } from '../../middleware/requireApiKey.js';

const router = Router();

// Cache list for 5 minutes
router
  .route('/')
  .get(cacheMiddleware(300, 'players'), playerController.findAll)
  .post(requireApiKey, playerController.create);

// Cache individual player for 10 minutes
router
  .route('/:id')
  .get(cacheMiddleware(600, 'players'), playerController.findById)
  .put(requireApiKey, playerController.update)
  .delete(requireApiKey, playerController.delete);

export { router as playerRouter };
