/**
 * Custom application error class for operational errors.
 *
 * Operational errors are expected errors that we can anticipate and handle
 * gracefully (e.g., "resource not found", "validation failed").
 *
 * Programming errors (bugs) should NOT use this class — they should
 * crash the process so we can fix them.
 *
 * @example
 * ```ts
 * throw new AppError('League not found', 404, 'LEAGUE_NOT_FOUND');
 * ```
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    // Preserve proper stack trace in V8
    Error.captureStackTrace(this, this.constructor);

    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Factory: 400 Bad Request
   */
  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(message, 400, 'BAD_REQUEST', details);
  }

  /**
   * Factory: 401 Unauthorized
   */
  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  /**
   * Factory: 403 Forbidden
   */
  static forbidden(message = 'Access denied'): AppError {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  /**
   * Factory: 404 Not Found
   */
  static notFound(resource: string, id?: string | number): AppError {
    const message = id
      ? `${resource} with id '${String(id)}' not found`
      : `${resource} not found`;
    return new AppError(message, 404, 'NOT_FOUND');
  }

  /**
   * Factory: 409 Conflict
   */
  static conflict(message: string): AppError {
    return new AppError(message, 409, 'CONFLICT');
  }

  /**
   * Factory: 422 Unprocessable Entity
   */
  static unprocessable(message: string, details?: unknown): AppError {
    return new AppError(message, 422, 'UNPROCESSABLE_ENTITY', details);
  }

  /**
   * Factory: 429 Too Many Requests
   */
  static tooManyRequests(message = 'Rate limit exceeded'): AppError {
    return new AppError(message, 429, 'TOO_MANY_REQUESTS');
  }

  /**
   * Factory: 500 Internal Server Error
   */
  static internal(message = 'Internal server error'): AppError {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }

  /**
   * Factory: 503 Service Unavailable
   */
  static serviceUnavailable(
    message = 'Service temporarily unavailable',
  ): AppError {
    return new AppError(message, 503, 'SERVICE_UNAVAILABLE');
  }
}
