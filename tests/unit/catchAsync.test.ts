import { afterEach, describe, expect, it, vi } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';
import { catchAsync, DATABASE_RETRY_DELAY_MS } from '../../src/utils/catchAsync.js';

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

function timeoutError(): Error {
  return Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' });
}

describe('catchAsync database retry', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a transient database error once and then succeeds', async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn<(req: Request, res: Response, next: NextFunction) => Promise<void>>()
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(undefined);
    const next = vi.fn();
    const res = { headersSent: false } as Response;

    catchAsync(fn)({} as Request, res, next);
    await vi.advanceTimersByTimeAsync(0);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(next).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DATABASE_RETRY_DELAY_MS);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards the second failure when the retry also times out', async () => {
    vi.useFakeTimers();
    const second = new Error('still starting up');
    const fn = vi
      .fn<(req: Request, res: Response, next: NextFunction) => Promise<void>>()
      .mockRejectedValueOnce(timeoutError())
      .mockRejectedValueOnce(second);
    const next = vi.fn();

    catchAsync(fn)({} as Request, { headersSent: false } as Response, next);
    await vi.advanceTimersByTimeAsync(DATABASE_RETRY_DELAY_MS);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(second);
  });

  it('does not retry when headers were already sent', async () => {
    vi.useFakeTimers();
    const err = timeoutError();
    const fn = vi
      .fn<(req: Request, res: Response, next: NextFunction) => Promise<void>>()
      .mockRejectedValueOnce(err);
    const next = vi.fn();

    catchAsync(fn)({} as Request, { headersSent: true } as Response, next);
    await vi.advanceTimersByTimeAsync(DATABASE_RETRY_DELAY_MS);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(err);
  });

  it('does not retry a non-transient error', async () => {
    const err = new Error('Cannot read properties of undefined');
    const fn = vi
      .fn<(req: Request, res: Response, next: NextFunction) => Promise<void>>()
      .mockRejectedValueOnce(err);
    const next = vi.fn();

    catchAsync(fn)({} as Request, { headersSent: false } as Response, next);
    await Promise.resolve();
    await Promise.resolve();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(err);
  });
});
