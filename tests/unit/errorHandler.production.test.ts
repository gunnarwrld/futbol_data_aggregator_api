import { beforeAll, describe, expect, it, vi } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';

vi.mock('../../src/config/index.js', () => ({
  config: { NODE_ENV: 'production', LOG_LEVEL: 'error' },
}));

type Handler = (err: Error, req: Request, res: Response, next: NextFunction) => void;

let errorHandler: Handler;

beforeAll(async () => {
  const module = await import('../../src/middleware/errorHandler.js');
  errorHandler = module.errorHandler;
});

describe('errorHandler in production', () => {
  it('hides unexpected error messages and stack traces', () => {
    const res = {
      statusCode: 0,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    };

    errorHandler(
      new Error('secret query failed'),
      {} as Request,
      res as unknown as Response,
      vi.fn(),
    );

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      success: false,
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        statusCode: 500,
      },
    });
  });
});
