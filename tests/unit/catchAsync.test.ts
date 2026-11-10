import { describe, expect, it, vi } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';
import { catchAsync } from '../../src/utils/catchAsync.js';

describe('catchAsync', () => {
  it('forwards a resolved handler without calling next', async () => {
    const next = vi.fn();
    const handler = catchAsync(async (_req, res) => {
      res.status(204);
    });
    const res = { status: vi.fn() } as unknown as Response;

    handler({} as Request, res, next as NextFunction);
    await vi.waitFor(() => {
      expect(res.status).toHaveBeenCalledWith(204);
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards a rejected handler to next', async () => {
    const next = vi.fn();
    const failure = new Error('boom');
    const handler = catchAsync(async () => {
      throw failure;
    });

    handler({} as Request, {} as Response, next as NextFunction);
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith(failure);
    });
  });
});
