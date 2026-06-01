import { Router } from 'express';
import { playerController } from '../../controllers/player.controller.js';
import { cacheMiddleware } from '../../middleware/cache.js';

const router = Router();

// Cache list for 5 minutes
router
  .route('/')
  .get(cacheMiddleware(300, 'players'), playerController.findAll)
  .post(playerController.create);

// Cache individual player for 10 minutes
router
  .route('/:id')
  .get(cacheMiddleware(600, 'players'), playerController.findById)
  .put(playerController.update)
  .delete(playerController.delete);

export { router as playerRouter };
