import { describe, it, expect } from 'vitest';
import { AppError } from '../../src/utils/AppError.js';

describe('AppError', () => {
  describe('constructor', () => {
    it('should create an error with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    it('should include optional details', () => {
      const details = { field: 'email', issue: 'invalid' };
      const error = new AppError('Validation failed', 422, 'VALIDATION_ERROR', details);

      expect(error.details).toEqual(details);
    });
  });

  describe('factory methods', () => {
    it('should create a 400 Bad Request error', () => {
      const error = AppError.badRequest('Invalid input');

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid input');
    });

    it('should create a 401 Unauthorized error', () => {
      const error = AppError.unauthorized();

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Authentication required');
    });

    it('should create a 403 Forbidden error', () => {
      const error = AppError.forbidden();

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });

    it('should create a 404 Not Found error with resource name', () => {
      const error = AppError.notFound('League', 42);

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe("League with id '42' not found");
    });

    it('should create a 404 Not Found error without id', () => {
      const error = AppError.notFound('League');

      expect(error.message).toBe('League not found');
    });

    it('should create a 409 Conflict error', () => {
      const error = AppError.conflict('League already exists');

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    it('should create a 422 Unprocessable Entity error', () => {
      const error = AppError.unprocessable('Invalid data', { field: 'name' });

      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(error.details).toEqual({ field: 'name' });
    });

    it('should create a 429 Too Many Requests error', () => {
      const error = AppError.tooManyRequests();

      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('TOO_MANY_REQUESTS');
    });

    it('should create a 500 Internal Server Error', () => {
      const error = AppError.internal();

      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should create a 503 Service Unavailable error', () => {
      const error = AppError.serviceUnavailable();

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });
});
