import { type Request, type Response } from 'express';
import { leagueService } from '../services/league.service.js';
import { apiResponse } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const leagueController = {
  findAll: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query['page']) || 1;
    const limit = Math.min(Number(req.query['limit']) || 20, 100);
    const sortBy = (req.query['sortBy'] as string) || 'name';
    const sortOrder = (req.query['sortOrder'] as 'asc' | 'desc') || 'asc';

    const filters = {
      country: req.query['country'] as string | undefined,
      season: req.query['season'] as string | undefined,
    };

    const result = await leagueService.findAll({ page, limit, sortBy, sortOrder }, filters);

    apiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),

  findById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    const league = await leagueService.findById(id);
    apiResponse.success(res, 200, league);
  }),

  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const league = await leagueService.create(req.body as Parameters<typeof leagueService.create>[0]);
    apiResponse.created(res, league);
  }),

  update: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    const league = await leagueService.update(id, req.body as Parameters<typeof leagueService.update>[1]);
    apiResponse.success(res, 200, league);
  }),

  delete: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    await leagueService.delete(id);
    apiResponse.noContent(res);
  }),
};
