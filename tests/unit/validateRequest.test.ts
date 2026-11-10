import { describe, expect, it, vi } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { validateRequest } from '../../src/middleware/validateRequest.js';
import { AppError } from '../../src/utils/AppError.js';

const schema = z.object({
  name: z.string().min(1),
  season: z.coerce.number().int(),
});

function run(
  target: 'body' | 'query' | 'params',
  value: unknown,
): {
  req: Request;
  next: ReturnType<typeof vi.fn>;
} {
  const req = { body: {}, query: {}, params: {}, [target]: value } as unknown as Request;
  const next = vi.fn();
  validateRequest(target, schema)(req, {} as Response, next as NextFunction);
  return { req, next };
}

describe('validateRequest', () => {
  it('replaces the target with parsed data, including coercion', () => {
    const { req, next } = run('body', { name: 'Primeira Liga', season: '2025' });

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ name: 'Primeira Liga', season: 2025 });
  });

  it('parses query and params the same way as body', () => {
    const query = run('query', { name: 'Liga', season: '2024' });
    const params = run('params', { name: 'Liga', season: '2023' });

    expect(query.req.query).toEqual({ name: 'Liga', season: 2024 });
    expect(params.req.params).toEqual({ name: 'Liga', season: 2023 });
  });

  it('turns a Zod failure into a 400 AppError with field details', () => {
    const { next } = run('body', { name: '', season: 'nope' });

    expect(next).toHaveBeenCalledOnce();
    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.details).toEqual(
      expect.objectContaining({
        name: expect.any(Array),
        season: expect.any(Array),
      }),
    );
  });

  it('forwards errors that are not Zod failures', () => {
    const next = vi.fn();
    const failure = new Error('parser blew up');
    const broken = {
      parse: () => {
        throw failure;
      },
    } as unknown as z.ZodType;

    validateRequest('body', broken)({ body: {} } as Request, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
