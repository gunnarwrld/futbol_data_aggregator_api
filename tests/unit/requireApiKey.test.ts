import { type NextFunction, type Request, type Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requireApiKey } from '../../src/middleware/requireApiKey.js';

function createRes(): Response & { statusCode: number; body: unknown } {
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
  return res as Response & { statusCode: number; body: unknown };
}

describe('requireApiKey', () => {
  it('continues when a valid key is already attached', () => {
    const next = vi.fn();
    const req = {
      headers: { 'x-api-key': 'fda_present' },
      apiKey: { id: '1', name: 'Mobile', tier: 'standard', rateLimit: 1000, isAdmin: false },
    } as Request;

    requireApiKey(req, createRes(), next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects a missing key', () => {
    const next = vi.fn();
    const res = createRes();

    requireApiKey({ headers: {} } as Request, res, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: {
        message: 'A valid API key is required for this route',
        code: 'API_KEY_REQUIRED',
        statusCode: 401,
      },
    });
  });

  it('rejects a provided key that was not authenticated', () => {
    const next = vi.fn();
    const res = createRes();

    requireApiKey(
      { headers: { 'x-api-key': 'fda_unknown' } } as unknown as Request,
      res,
      next as NextFunction,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect((res.body as { error: { code: string } }).error.code).toBe('INVALID_API_KEY');
  });
});
