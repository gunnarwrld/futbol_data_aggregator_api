import { type Request, type Response } from 'express';
import { playerService } from '../services/player.service.js';
import { apiResponse } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const playerController = {
  findAll: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query['page']) || 1;
    const limit = Math.min(Number(req.query['limit']) || 20, 100);
    const sortBy = (req.query['sortBy'] as string) || 'name';
    const sortOrder = (req.query['sortOrder'] as 'asc' | 'desc') || 'asc';

    const filters = {
      teamId: req.query['teamId'] as string | undefined,
      position: req.query['position'] as string | undefined,
    };

    const result = await playerService.findAll({ page, limit, sortBy, sortOrder }, filters);

    apiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),

  findById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    const player = await playerService.findById(id);
    apiResponse.success(res, 200, player);
  }),

  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const player = await playerService.create(req.body as Parameters<typeof playerService.create>[0]);
    apiResponse.created(res, player);
  }),

  update: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    const player = await playerService.update(id, req.body as Parameters<typeof playerService.update>[1]);
    apiResponse.success(res, 200, player);
  }),

  delete: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    await playerService.delete(id);
    apiResponse.noContent(res);
  }),
};
