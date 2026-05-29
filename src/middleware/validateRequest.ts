import { type Request, type Response, type NextFunction } from 'express';
import { type ZodSchema, ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';

/**
 * Request validation targets.
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Generic request validation middleware factory using Zod schemas.
 *
 * Validates the specified part of the request (body, query, or params)
 * against a Zod schema. On failure, throws an AppError with structured
 * validation details.
 *
 * @example
 * ```ts
 * const createLeagueSchema = z.object({
 *   name: z.string().min(1).max(100),
 *   country: z.string().min(1).max(100),
 *   season: z.number().int().min(2000).max(2100),
 * });
 *
 * router.post(
 *   '/leagues',
 *   validateRequest('body', createLeagueSchema),
 *   leagueController.create,
 * );
 * ```
 */
export const validateRequest = (
  target: ValidationTarget,
  schema: ZodSchema,
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[target]);

      // Replace the raw data with the parsed (and possibly transformed) data
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
      (req as any)[target] = parsed;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.flatten().fieldErrors;
        next(
          AppError.badRequest('Validation failed', details),
        );
        return;
      }
      next(error);
    }
  };
};
