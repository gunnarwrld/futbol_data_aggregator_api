import { type Request, type Response, type NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { isTransientDatabaseError } from './databaseErrors.js';

/**
 * Pause before the single retry so a sleeping Postgres has a moment to accept
 * connections. One retry only — a second failure is returned to the client.
 */
export const DATABASE_RETRY_DELAY_MS = 2_000;

/**
 * Methods that only read. A retried POST, PUT, PATCH, or DELETE can run the
 * write again after the first attempt already committed: manual creates do
 * not require `externalId`, and PostgreSQL treats each NULL as distinct, so
 * the unique column does not stop a second insert.
 */
const RETRY_SAFE_METHODS = new Set(['GET', 'HEAD']);

function canRetryTransientDatabaseError(req: Request, res: Response): boolean {
  return !res.headersSent && RETRY_SAFE_METHODS.has(req.method.toUpperCase());
}

/**
 * Wraps an async Express route handler to automatically catch rejected
 * promises and forward them to the Express error-handling middleware.
 *
 * Without this wrapper, unhandled promise rejections in async handlers
 * would cause the request to hang indefinitely.
 *
 * A transient database error (wake-up timeout, connection reset) is retried
 * once for GET and HEAD when the response has not started. Writes are not
 * retried. A second failure is forwarded as-is.
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
    fn(req, res, next).catch((err: unknown) => {
      if (!isTransientDatabaseError(err) || !canRetryTransientDatabaseError(req, res)) {
        next(err);
        return;
      }

      logger.warn({ err }, 'Transient database error; retrying the request once');

      setTimeout(() => {
        fn(req, res, next).catch((retryErr: unknown) => {
          next(retryErr);
        });
      }, DATABASE_RETRY_DELAY_MS);
    });
  };
};
