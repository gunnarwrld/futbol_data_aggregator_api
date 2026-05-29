import { Router } from 'express';
import { playerController } from '../../controllers/player.controller.js';

const router = Router();

router
  .route('/')
  .get(playerController.findAll)
  .post(playerController.create);

router
  .route('/:id')
  .get(playerController.findById)
  .put(playerController.update)
  .delete(playerController.delete);

export { router as playerRouter };
