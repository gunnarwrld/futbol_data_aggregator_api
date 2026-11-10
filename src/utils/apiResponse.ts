import { type Response } from 'express';
import { type ApiSuccessResponse, type PaginationMeta } from '../types/index.js';

/**
 * Standardized API response utilities.
 *
 * Every API endpoint MUST use these helpers to ensure 100% consistent
 * response formatting across the entire application.
 *
 * @example
 * ```ts
 * // Success with data
 * apiResponse.success(res, 200, leagues);
 *
 * // Success with pagination
 * apiResponse.paginated(res, leagues, { page: 1, limit: 20, total: 100, totalPages: 5 });
 *
 * // No content
 * apiResponse.noContent(res);
 * ```
 */
export const apiResponse = {
  /**
   * Send a success response with data.
   */
  // T types the payload. The helper sends it and returns void.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  success<T>(res: Response, statusCode: number, data: T, meta?: PaginationMeta): void {
    const response: ApiSuccessResponse<T> = {
      success: true,
      data,
      ...(meta && { meta }),
    };

    res.status(statusCode).json(response);
  },

  /**
   * Send a paginated success response.
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  paginated<T>(res: Response, data: T[], meta: PaginationMeta): void {
    apiResponse.success(res, 200, data, meta);
  },

  /**
   * Send a 201 Created response.
   */
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  created<T>(res: Response, data: T): void {
    apiResponse.success(res, 201, data);
  },

  /**
   * Send a 204 No Content response (e.g., after DELETE).
   */
  noContent(res: Response): void {
    res.status(204).send();
  },
} as const;
