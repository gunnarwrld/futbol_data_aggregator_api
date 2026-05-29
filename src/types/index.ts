import { type Request, type Response, type NextFunction } from 'express';

/* ── API Response Types ──────────────────────────────────── */

/**
 * Standardized success response envelope.
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/**
 * Standardized error response envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    statusCode: number;
    details?: unknown;
  };
}

/**
 * Pagination metadata returned in list endpoints.
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ── Pagination Query ────────────────────────────────────── */

/**
 * Standard pagination query parameters.
 */
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/* ── Express Augmentation ────────────────────────────────── */

/**
 * Typed async request handler to pair with catchAsync utility.
 */
export type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

/* ── Service Layer Types ─────────────────────────────────── */

/**
 * Base pagination input for service and repository layers.
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Paginated result from repository/service layer.
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/* ── API-Football Types ──────────────────────────────────── */

/**
 * Generic API-Football response wrapper.
 */
export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | unknown[];
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}
