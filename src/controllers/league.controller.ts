import { type Request, type Response } from 'express';
import { leagueService } from '../services/league.service.js';
import { apiResponse } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

/**
 * League Controller — HTTP Request/Response Layer
 *
 * Responsibilities:
 * 1. Extract data from request (params, query, body)
 * 2. Delegate to service layer
 * 3. Format and send response via apiResponse utility
 *
 * No business logic belongs here.
 */
export const leagueController = {
  /**
   * GET /api/v1/leagues
   * Retrieve all leagues with pagination and filtering.
   */
  findAll: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const page = Number(req.query['page']) || 1;
    const limit = Math.min(Number(req.query['limit']) || 20, 100);
    const sortBy = (req.query['sortBy'] as string) || 'name';
    const sortOrder = (req.query['sortOrder'] as 'asc' | 'desc') || 'asc';

    const filters = {
      countryId: req.query['countryId'] ? Number(req.query['countryId']) : undefined,
      season: req.query['season'] ? Number(req.query['season']) : undefined,
      type: req.query['type'] as string | undefined,
    };

    const result = await leagueService.findAll({ page, limit, sortBy, sortOrder }, filters);

    apiResponse.paginated(res, result.data, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  }),

  /**
   * GET /api/v1/leagues/:id
   * Retrieve a single league by ID.
   */
  findById: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    const league = await leagueService.findById(id);
    apiResponse.success(res, 200, league);
  }),

  /**
   * POST /api/v1/leagues
   * Create a new league.
   */
  create: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const league = await leagueService.create(req.body as Parameters<typeof leagueService.create>[0]);
    apiResponse.created(res, league);
  }),

  /**
   * PUT /api/v1/leagues/:id
   * Update an existing league.
   */
  update: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    const league = await leagueService.update(id, req.body as Parameters<typeof leagueService.update>[1]);
    apiResponse.success(res, 200, league);
  }),

  /**
   * DELETE /api/v1/leagues/:id
   * Delete a league.
   */
  delete: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    await leagueService.delete(id);
    apiResponse.noContent(res);
  }),
};
