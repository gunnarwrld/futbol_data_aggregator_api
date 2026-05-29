import { type Request, type Response, type NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import { type ApiErrorResponse } from '../types/index.js';

/**
 * Global error handling middleware.
 *
 * Catches all errors thrown or forwarded via `next(err)` and sends
 * a standardized JSON error response.
 *
 * - **Operational errors** (AppError): Returns the error message and code to the client.
 * - **Programming errors**: Logs the full stack trace and returns a generic 500 response.
 * - **Prisma errors**: Maps known Prisma error codes to appropriate HTTP responses.
 * - **Zod validation errors**: Formats validation details for the client.
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  /* ── Operational Errors (expected) ───────────────────── */
  if (err instanceof AppError) {
    const errorBody: ApiErrorResponse['error'] = {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
    };

    if (err.details) {
      errorBody.details = err.details;
    }

    const response: ApiErrorResponse = {
      success: false,
      error: errorBody,
    };

    if (err.statusCode >= 500) {
      logger.error({ err }, 'Operational server error');
    } else {
      logger.warn({ err }, 'Operational client error');
    }

    res.status(err.statusCode).json(response);
    return;
  }

  /* ── Prisma Known Errors ─────────────────────────────── */
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as Error & { code: string; meta?: Record<string, unknown> };
    const mapped = mapPrismaError(prismaError);

    const response: ApiErrorResponse = {
      success: false,
      error: {
        message: mapped.message,
        code: mapped.code,
        statusCode: mapped.statusCode,
      },
    };

    logger.warn({ err, prismaCode: prismaError.code }, 'Prisma error');
    res.status(mapped.statusCode).json(response);
    return;
  }

  /* ── Zod Validation Errors ───────────────────────────── */
  if (err.constructor.name === 'ZodError') {
    const zodError = err as Error & { flatten: () => { fieldErrors: Record<string, string[]> } };
    const response: ApiErrorResponse = {
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 422,
        details: zodError.flatten().fieldErrors,
      },
    };

    logger.warn({ err }, 'Validation error');
    res.status(422).json(response);
    return;
  }

  /* ── Unexpected Errors (bugs) ────────────────────────── */
  logger.error({ err }, 'Unexpected error');

  const errorBody: ApiErrorResponse['error'] = {
    message:
      config.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    code: 'INTERNAL_ERROR',
    statusCode: 500,
  };

  if (config.NODE_ENV !== 'production') {
    errorBody.details = err.stack;
  }

  const response: ApiErrorResponse = {
    success: false,
    error: errorBody,
  };

  res.status(500).json(response);
};

/* ── Prisma Error Mapping ──────────────────────────────── */

interface MappedError {
  message: string;
  code: string;
  statusCode: number;
}

function mapPrismaError(err: { code: string; meta?: Record<string, unknown> }): MappedError {
  switch (err.code) {
    case 'P2002':
      return {
        message: `Duplicate value for unique field: ${String(err.meta?.['target'] ?? 'unknown')}`,
        code: 'DUPLICATE_ENTRY',
        statusCode: 409,
      };
    case 'P2025':
      return {
        message: 'Record not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      };
    case 'P2003':
      return {
        message: 'Foreign key constraint failed',
        code: 'FOREIGN_KEY_ERROR',
        statusCode: 400,
      };
    default:
      return {
        message: 'Database error',
        code: 'DATABASE_ERROR',
        statusCode: 500,
      };
  }
}
