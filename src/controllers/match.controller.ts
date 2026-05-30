import { type Request, type Response } from 'express';
import { matchService } from '../services/match.service.js';
import { apiResponse } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const matchController = {
  findAll: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query['page']) || 1;
    const limit = Math.min(Number(req.query['limit']) || 20, 100);
    const sortBy = (req.query['sortBy'] as string) || 'matchDate';
    const sortOrder = (req.query['sortOrder'] as 'asc' | 'desc') || 'desc';

    const filters = {
      leagueId: req.query['leagueId'] as string | undefined,
      teamId: req.query['teamId'] as string | undefined,
      status: req.query['status'] as string | undefined,
      startDate: req.query['startDate']
        ? new Date(req.query['startDate'] as string)
        : undefined,
      endDate: req.query['endDate']
        ? new Date(req.query['endDate'] as string)
        : undefined,
    };

    const result = await matchService.findAll({ page, limit, sortBy, sortOrder }, filters);

    apiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),

  findLiveMatches: catchAsync(async (_req: Request, res: Response): Promise<void> => {
    const liveMatches = await matchService.findLiveMatches();
    apiResponse.success(res, 200, liveMatches);
  }),

  findById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    const match = await matchService.findById(id);
    apiResponse.success(res, 200, match);
  }),

  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const match = await matchService.create(req.body as Parameters<typeof matchService.create>[0]);
    apiResponse.created(res, match);
  }),

  update: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    const match = await matchService.update(id, req.body as Parameters<typeof matchService.update>[1]);
    apiResponse.success(res, 200, match);
  }),

  delete: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    await matchService.delete(id);
    apiResponse.noContent(res);
  }),
};
