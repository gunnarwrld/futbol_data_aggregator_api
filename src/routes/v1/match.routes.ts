import { Router } from 'express';
import { matchController } from '../../controllers/match.controller.js';
import { cacheMiddleware } from '../../middleware/cache.js';

const router = Router();

// Live matches — short cache TTL (30 seconds)
router.get('/live', cacheMiddleware(30, 'matches:live'), matchController.findLiveMatches);
router.get('/:id', matchController.findById);

router
  .route('/')
  .get(matchController.findAll)
  .post(matchController.create);

router
  .route('/:id')
  .get(matchController.findById)
  .put(matchController.update)
  .delete(matchController.delete);

export { router as matchRouter };
