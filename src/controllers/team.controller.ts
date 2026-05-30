import { type Request, type Response } from 'express';
import { teamService } from '../services/team.service.js';
import { apiResponse } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

export const teamController = {
  findAll: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query['page']) || 1;
    const limit = Math.min(Number(req.query['limit']) || 20, 100);
    const sortBy = (req.query['sortBy'] as string) || 'name';
    const sortOrder = (req.query['sortOrder'] as 'asc' | 'desc') || 'asc';

    const filters = {
      name: req.query['name'] as string | undefined,
    };

    const result = await teamService.findAll({ page, limit, sortBy, sortOrder }, filters);

    apiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),

  findById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    const team = await teamService.findById(id);
    apiResponse.success(res, 200, team);
  }),

  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const team = await teamService.create(req.body as Parameters<typeof teamService.create>[0]);
    apiResponse.created(res, team);
  }),

  update: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    const team = await teamService.update(id, req.body as Parameters<typeof teamService.update>[1]);
    apiResponse.success(res, 200, team);
  }),

  delete: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = req.params['id'] as string;
    await teamService.delete(id);
    apiResponse.noContent(res);
  }),
};
