import { describe, expect, it, vi } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { errorHandler } from '../../src/middleware/errorHandler.js';
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
