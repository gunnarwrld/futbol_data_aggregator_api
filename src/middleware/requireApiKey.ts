import { type NextFunction, type Request, type Response } from 'express';

/**
 * Rejects the request unless `authenticateApiKey` already attached a valid key.
 *
 * Mount this on writes and key administration. Public reads do not use it.
 * An invalid key is rejected earlier by `authenticateApiKey`. This middleware
 * covers a missing key, and a provided key whose lookup failed open.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  if (req.apiKey) {
    next();
    return;
  }

  const header = req.headers['x-api-key'];
  const provided = typeof header === 'string' && header.length > 0;

  res.status(401).json({
    success: false,
    error: {
      message: provided
        ? 'Invalid, expired, or revoked API key'
        : 'A valid API key is required for this route',
      code: provided ? 'INVALID_API_KEY' : 'API_KEY_REQUIRED',
      statusCode: 401,
    },
  });
}
