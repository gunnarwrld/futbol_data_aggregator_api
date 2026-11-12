import { type NextFunction, type Request, type Response } from 'express';
import { requireApiKey } from './requireApiKey.js';

/** Restrict key administration to explicitly privileged keys. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.apiKey) {
    requireApiKey(req, res, next);
    return;
  }

  // Require an explicit true even if runtime data does not match the declared type.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-boolean-literal-compare
  if (req.apiKey.isAdmin !== true) {
    res.status(403).json({
      success: false,
      error: {
        message: 'An admin API key is required for this route',
        code: 'ADMIN_KEY_REQUIRED',
        statusCode: 403,
      },
    });
    return;
  }

  next();
}
