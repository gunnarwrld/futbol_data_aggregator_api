import { type Request, type Response, type NextFunction } from 'express';

/**
 * Wraps an async Express route handler to automatically catch rejected
 * promises and forward them to the Express error-handling middleware.
 *
 * Without this wrapper, unhandled promise rejections in async handlers
 * would cause the request to hang indefinitely.
 *
 * @example
 * ```ts
 * router.get('/leagues', catchAsync(async (req, res) => {
 *   const leagues = await leagueService.findAll();
 *   res.json(apiResponse.success(leagues));
 * }));
 * ```
 */
export const catchAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
};
