import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';
import { redis } from '../../src/config/redis.js';
import { cacheMiddleware, invalidateCache } from '../../src/middleware/cache.js';

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue('OK'),
    keys: vi.fn(),
    del: vi.fn(),
  },
  disconnectRedis: vi.fn(),
}));

interface FakeResponse {
  statusCode: number;
  headers: Map<string, unknown>;
  json: (body: unknown) => FakeResponse;
  setHeader: (name: string, value: unknown) => void;
}

function createRes(statusCode = 200): FakeResponse {
  const res: FakeResponse = {
    statusCode,
    headers: new Map(),
    setHeader(name: string, value: unknown) {
      this.headers.set(name, value);
    },
    json(body: unknown) {
      void body;
      return this;
    },
  };
  return res;
}

describe('cacheMiddleware', () => {
  const get = vi.mocked(redis.get);
  const setex = vi.mocked(redis.setex);

  beforeEach(() => {
    vi.clearAllMocks();
    setex.mockResolvedValue('OK');
  });

  it('does not cache non-GET requests', async () => {
    const next = vi.fn();
    const middleware = cacheMiddleware(30, 'leagues');

    await middleware(
      { method: 'POST', originalUrl: '/api/v1/leagues' } as Request,
      createRes() as unknown as Response,
      next as NextFunction,
    );

    expect(get).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns a hit without calling the controller', async () => {
    get.mockResolvedValue(JSON.stringify({ success: true, data: [{ id: '1' }] }));
    const next = vi.fn();
    const res = createRes();
    const json = vi.spyOn(res, 'json');

    await cacheMiddleware(60, 'leagues')(
      { method: 'GET', originalUrl: '/api/v1/leagues' } as Request,
      res as unknown as Response,
      next as NextFunction,
    );

    expect(res.headers.get('X-Cache')).toBe('HIT');
    expect(json).toHaveBeenCalledWith({ success: true, data: [{ id: '1' }] });
    expect(next).not.toHaveBeenCalled();
  });

  it('stores a 2xx miss under prefix plus the original URL', async () => {
    get.mockResolvedValue(null);
    const next = vi.fn();
    const res = createRes(200);
    const req = { method: 'GET', originalUrl: '/api/v1/leagues?page=2' } as Request;

    await cacheMiddleware(120, 'leagues')(req, res as unknown as Response, next as NextFunction);
    const body = { success: true, data: [] };
    res.json(body);
    await Promise.resolve();

    expect(res.headers.get('X-Cache')).toBe('MISS');
    expect(next).toHaveBeenCalledOnce();
    expect(setex).toHaveBeenCalledWith('leagues:/api/v1/leagues?page=2', 120, JSON.stringify(body));
  });

  it('does not store error responses', async () => {
    get.mockResolvedValue(null);
    const res = createRes(404);

    await cacheMiddleware()(
      { method: 'GET', originalUrl: '/api/v1/leagues/missing' } as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );
    res.json({ success: false });
    await Promise.resolve();

    expect(setex).not.toHaveBeenCalled();
  });

  it('fails open when Redis read throws', async () => {
    get.mockRejectedValue(new Error('redis down'));
    const next = vi.fn();

    await cacheMiddleware()(
      { method: 'GET', originalUrl: '/api/v1/leagues' } as Request,
      createRes() as unknown as Response,
      next as NextFunction,
    );

    expect(next).toHaveBeenCalledOnce();
  });

  it('still sends the response when the cache write fails', async () => {
    get.mockResolvedValue(null);
    setex.mockRejectedValue(new Error('write failed'));
    const res = createRes();

    await cacheMiddleware()(
      { method: 'GET', originalUrl: '/api/v1/leagues' } as Request,
      res as unknown as Response,
      vi.fn() as NextFunction,
    );

    expect(() => res.json({ success: true })).not.toThrow();
    await vi.waitFor(() => {
      expect(setex).toHaveBeenCalledOnce();
    });
  });
});

describe('invalidateCache', () => {
  const keys = vi.mocked(redis.keys);
  const del = vi.mocked(redis.del);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes every key matching the pattern', async () => {
    keys.mockResolvedValue(['leagues:/api/v1/leagues', 'leagues:/api/v1/leagues/1']);

    await invalidateCache('leagues:*');

    expect(del).toHaveBeenCalledWith('leagues:/api/v1/leagues', 'leagues:/api/v1/leagues/1');
  });

  it('does nothing when the pattern matches no keys', async () => {
    keys.mockResolvedValue([]);

    await invalidateCache('leagues:*');

    expect(del).not.toHaveBeenCalled();
  });

  it('swallows Redis errors', async () => {
    keys.mockRejectedValue(new Error('scan failed'));

    await expect(invalidateCache('leagues:*')).resolves.toBeUndefined();
  });
});
