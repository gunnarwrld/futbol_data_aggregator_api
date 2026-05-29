import { Router } from 'express';
import { teamController } from '../../controllers/team.controller.js';

const router = Router();

router
  .route('/')
  .get(teamController.findAll)
  .post(teamController.create);

router
  .route('/:id')
  .get(teamController.findById)
  .put(teamController.update)
  .delete(teamController.delete);

export { router as teamRouter };
