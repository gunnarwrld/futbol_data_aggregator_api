import { type Request, type Response } from 'express';
import { matchService } from '../services/match.service.js';
import { apiResponse } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

/**
 * Match Controller — HTTP Request/Response Layer
 */
export const matchController = {
  findAll: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query['page']) || 1;
    const limit = Math.min(Number(req.query['limit']) || 20, 100);
    const sortBy = (req.query['sortBy'] as string) || 'date';
    const sortOrder = (req.query['sortOrder'] as 'asc' | 'desc') || 'desc';

    const filters = {
      leagueId: req.query['leagueId'] ? Number(req.query['leagueId']) : undefined,
      season: req.query['season'] ? Number(req.query['season']) : undefined,
      teamId: req.query['teamId'] ? Number(req.query['teamId']) : undefined,
      status: req.query['status'] as string | undefined,
      dateFrom: req.query['dateFrom'] ? new Date(req.query['dateFrom'] as string) : undefined,
      dateTo: req.query['dateTo'] ? new Date(req.query['dateTo'] as string) : undefined,
    };

    const result = await matchService.findAll({ page, limit, sortBy, sortOrder }, filters);

    apiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),

  findById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    const match = await matchService.findById(id);
    apiResponse.success(res, 200, match);
  }),

  /**
   * GET /api/v1/matches/live
   * Returns all currently in-progress matches.
   */
  findLive: catchAsync(async (_req: Request, res: Response): Promise<void> => {
    const matches = await matchService.findLive();
    apiResponse.success(res, 200, matches);
  }),

  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const match = await matchService.create(req.body as Parameters<typeof matchService.create>[0]);
    apiResponse.created(res, match);
  }),

  update: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    const match = await matchService.update(id, req.body as Parameters<typeof matchService.update>[1]);
    apiResponse.success(res, 200, match);
  }),

  delete: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    await matchService.delete(id);
    apiResponse.noContent(res);
  }),
};
