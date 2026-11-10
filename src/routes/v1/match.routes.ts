import { Router } from 'express';
import { matchController } from '../../controllers/match.controller.js';
import { cacheMiddleware } from '../../middleware/cache.js';
import { requireApiKey } from '../../middleware/requireApiKey.js';

const router = Router();

// Live matches — short cache TTL (30 seconds)
router.get('/live', cacheMiddleware(30, 'matches:live'), matchController.findLiveMatches);

// Cache individual match for 60 seconds (they update often)
router.get('/:id', cacheMiddleware(60, 'matches'), matchController.findById);

router
  .route('/')
  .get(cacheMiddleware(120, 'matches'), matchController.findAll)
  .post(requireApiKey, matchController.create);

router
  .route('/:id')
  .get(matchController.findById)
  .put(requireApiKey, matchController.update)
  .delete(requireApiKey, matchController.delete);

export { router as matchRouter };
