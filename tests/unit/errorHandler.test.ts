import { describe, expect, it, vi } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { isTransientDatabaseError } from '../../src/utils/databaseErrors.js';
import { AppError } from '../../src/utils/AppError.js';

function mockRes(): Response & { body: unknown; statusCode: number } {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as Response & { body: unknown; statusCode: number };
}

class PrismaClientKnownRequestError extends Error {
  code: string;
  meta?: Record<string, unknown>;

  constructor(code: string, meta?: Record<string, unknown>) {
    super(code);
    this.code = code;
    this.meta = meta;
  }
}

describe('errorHandler', () => {
  const req = {} as Request;
  const next = vi.fn() as unknown as NextFunction;

  it('serializes an operational AppError and omits empty details', () => {
    const res = mockRes();
    errorHandler(AppError.notFound('League', 'abc'), req, res, next);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        message: "League with id 'abc' not found",
        code: 'NOT_FOUND',
        statusCode: 404,
      },
    });
  });

  it('includes validation details from an operational error', () => {
    const res = mockRes();
    errorHandler(AppError.badRequest('Validation failed', { name: ['Required'] }), req, res, next);

    expect(res.statusCode).toBe(400);
    expect((res.body as { error: { details: unknown } }).error.details).toEqual({
      name: ['Required'],
    });
  });

  it('keeps the operational message for a 500 AppError', () => {
    const res = mockRes();
    errorHandler(AppError.internal('database offline'), req, res, next);

    expect(res.statusCode).toBe(500);
    expect((res.body as { error: { message: string } }).error.message).toBe('database offline');
  });

  it.each([
    ['P2002', 409, 'DUPLICATE_ENTRY', { target: ['email'] }, 'email'],
    [
      'P2002',
      409,
      'DUPLICATE_ENTRY',
      {
        driverAdapterError: {
          cause: { constraint: { fields: ['"externalId"'] } },
        },
      },
      'externalId',
    ],
    ['P2025', 404, 'NOT_FOUND', undefined, undefined],
    ['P2003', 400, 'FOREIGN_KEY_ERROR', undefined, undefined],
    ['P9999', 500, 'DATABASE_ERROR', undefined, undefined],
  ] as const)('maps Prisma %s to %s', (code, status, errorCode, meta, fragment) => {
    const res = mockRes();
    errorHandler(new PrismaClientKnownRequestError(code, meta), req, res, next);

    expect(res.statusCode).toBe(status);
    const body = res.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe(errorCode);
    if (fragment) expect(body.error.message).toContain(fragment);
  });

  it('formats a ZodError that bypassed the validation middleware', () => {
    const parsed = z.object({ name: z.string().min(1) }).safeParse({});
    if (parsed.success) throw new Error('expected a zod failure');

    const res = mockRes();
    errorHandler(parsed.error, req, res, next);

    expect(res.statusCode).toBe(422);
    const body = res.body as { error: { code: string; details: { name?: string[] } } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.name?.length).toBeGreaterThan(0);
  });

  it('exposes the message and stack outside production', () => {
    const res = mockRes();
    errorHandler(new Error('unexpected'), req, res, next);

    expect(res.statusCode).toBe(500);
    const body = res.body as { error: { message: string; details: unknown } };
    expect(body.error.message).toBe('unexpected');
    expect(body.error.details).toEqual(expect.any(String));
  });
});

class PrismaWakeError extends Error {
  readonly code: string;

  constructor(code: string, message = 'database request failed') {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
  }
}

class PrismaClientInitializationError extends Error {
  readonly code = 'P1001';

  constructor() {
    super("Can't reach database server at postgres.railway.internal");
    this.name = 'PrismaClientInitializationError';
  }
}

function statusRes(): Response {
  const res = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response;
}

describe('isTransientDatabaseError', () => {
  it('matches driver and Postgres wake-up codes', () => {
    expect(
      isTransientDatabaseError(Object.assign(new Error('connect'), { code: 'ETIMEDOUT' })),
    ).toBe(true);
    expect(
      isTransientDatabaseError(Object.assign(new Error('reset'), { code: 'ECONNRESET' })),
    ).toBe(true);
    expect(isTransientDatabaseError(Object.assign(new Error('starting'), { code: '57P03' }))).toBe(
      true,
    );
    expect(isTransientDatabaseError(new PrismaWakeError('P1002'))).toBe(true);
    expect(isTransientDatabaseError(new PrismaWakeError('P2024'))).toBe(true);
  });

  it('matches timeout messages and nested driver adapter errors', () => {
    expect(isTransientDatabaseError(new Error('timeout exceeded when trying to connect'))).toBe(
      true,
    );
    expect(isTransientDatabaseError(new Error('the database system is starting up'))).toBe(true);

    const wrapped = new Error('Invalid prisma.league.findMany() invocation');
    Object.assign(wrapped, {
      code: 'P2010',
      meta: { driverAdapterError: { originalCode: 'ETIMEDOUT', message: 'connect ETIMEDOUT' } },
    });

    expect(isTransientDatabaseError(wrapped)).toBe(true);
  });

  it('does not treat ordinary failures as transient', () => {
    expect(isTransientDatabaseError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isTransientDatabaseError(new PrismaWakeError('P2002'))).toBe(false);
    expect(isTransientDatabaseError(new PrismaWakeError('P2025'))).toBe(false);
    expect(isTransientDatabaseError(null)).toBe(false);
  });
});

describe('errorHandler database failures', () => {
  const req = {} as Request;
  const next = vi.fn() as unknown as NextFunction;

  it('maps a Prisma ETIMEDOUT to 503 instead of 500 DATABASE_ERROR', () => {
    const res = statusRes();

    errorHandler(new PrismaWakeError('ETIMEDOUT'), req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '5');
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Database is temporarily unavailable. Retry shortly.',
        code: 'DATABASE_UNAVAILABLE',
        statusCode: 503,
      },
    });
  });

  it('maps a raw ETIMEDOUT and a starting-up message to 503', () => {
    const timeoutRes = statusRes();
    errorHandler(
      Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }),
      req,
      timeoutRes,
      next,
    );

    const startingRes = statusRes();
    errorHandler(new Error('the database system is starting up'), req, startingRes, next);

    expect(timeoutRes.status).toHaveBeenCalledWith(503);
    expect(startingRes.status).toHaveBeenCalledWith(503);
  });

  it('maps Prisma initialization failures to 503', () => {
    const res = statusRes();

    errorHandler(new PrismaClientInitializationError(), req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('still maps duplicate and unknown Prisma codes to 409 and 500', () => {
    const duplicate = statusRes();
    errorHandler(new PrismaClientKnownRequestError('P2002', { target: 'externalId' }), req, duplicate, next);

    const unknown = statusRes();
    errorHandler(new PrismaClientKnownRequestError('P9999'), req, unknown, next);

    expect(duplicate.status).toHaveBeenCalledWith(409);
    expect(unknown.status).toHaveBeenCalledWith(500);
    expect(unknown.json).toHaveBeenCalledWith({
      success: false,
      error: {
        message: 'Database error',
        code: 'DATABASE_ERROR',
        statusCode: 500,
      },
    });
  });
});
