import { Router } from 'express';
import { leagueRouter } from './league.routes.js';
import { teamRouter } from './team.routes.js';
import { matchRouter } from './match.routes.js';
import { playerRouter } from './player.routes.js';

/**
 * V1 API Router — aggregates all v1 resource routes.
 */
const router = Router();

router.use('/leagues', leagueRouter);
router.use('/teams', teamRouter);
router.use('/matches', matchRouter);
router.use('/players', playerRouter);

export { router as v1Router };
