import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';
import { redis } from '../../src/config/redis.js';
import { slidingWindowRateLimiter } from '../../src/middleware/slidingWindowRateLimiter.js';

interface FakePipeline {
  zremrangebyscore: ReturnType<typeof vi.fn>;
  zadd: ReturnType<typeof vi.fn>;
  zcard: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  exec: ReturnType<typeof vi.fn>;
}

const pipeline: FakePipeline = {
  zremrangebyscore: vi.fn(),
  zadd: vi.fn(),
  zcard: vi.fn(),
  expire: vi.fn(),
  exec: vi.fn(),
};

vi.mock('../../src/config/redis.js', () => ({
  redis: {
    pipeline: vi.fn(() => pipeline),
    zrem: vi.fn().mockResolvedValue(1),
  },
  disconnectRedis: vi.fn(),
}));

function createRes(): Response & {
  statusCode: number;
  body: unknown;
  headers: Map<string, unknown>;
} {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers: new Map<string, unknown>(),
    setHeader(name: string, value: unknown) {
      res.headers.set(name, value);
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as Response & { statusCode: number; body: unknown; headers: Map<string, unknown> };
}

function createReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: '203.0.113.10',
    socket: { remoteAddress: '203.0.113.10' },
    ...overrides,
  } as Request;
}

describe('slidingWindowRateLimiter', () => {
  const zrem = vi.mocked(redis.zrem);

  beforeEach(() => {
    vi.clearAllMocks();
    pipeline.zremrangebyscore.mockReturnValue(pipeline);
    pipeline.zadd.mockReturnValue(pipeline);
    pipeline.zcard.mockReturnValue(pipeline);
    pipeline.expire.mockReturnValue(pipeline);
    zrem.mockResolvedValue(1);
  });

  function stubCount(count: number): void {
    pipeline.exec.mockResolvedValue([
      [null, 1],
      [null, 1],
      [null, count],
      [null, 1],
    ]);
  }

  it('allows an anonymous request inside the 50/hour window and sets headers', async () => {
    stubCount(50);
    const next = vi.fn();
    const res = createRes();

    await slidingWindowRateLimiter(createReq(), res, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(pipeline.zadd).toHaveBeenCalledWith(
      'ratelimit:ip:203.0.113.10',
      expect.any(Number),
      expect.any(String),
    );
    expect(res.headers.get('X-RateLimit-Limit')).toBe(50);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe(0);
    expect(res.headers.get('X-RateLimit-Reset')).toBe(3600);
  });

  it('uses the API key id and its own limit when a key is present', async () => {
    stubCount(3);
    const next = vi.fn();
    const req = createReq({
      apiKey: { id: 'key-9', name: 'app', tier: 'standard', rateLimit: 1000 },
    });

    await slidingWindowRateLimiter(req, createRes(), next as NextFunction);

    expect(pipeline.zadd).toHaveBeenCalledWith(
      'ratelimit:apikey:key-9',
      expect.any(Number),
      expect.any(String),
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('falls back to the socket address and then to unknown', async () => {
    stubCount(1);
    await slidingWindowRateLimiter(
      createReq({ ip: undefined, socket: { remoteAddress: '198.51.100.4' } } as Partial<Request>),
      createRes(),
      vi.fn() as NextFunction,
    );
    await slidingWindowRateLimiter(
      createReq({ ip: undefined, socket: {} } as Partial<Request>),
      createRes(),
      vi.fn() as NextFunction,
    );

    expect(pipeline.zadd).toHaveBeenNthCalledWith(
      1,
      'ratelimit:ip:198.51.100.4',
      expect.any(Number),
      expect.any(String),
    );
    expect(pipeline.zadd).toHaveBeenNthCalledWith(
      2,
      'ratelimit:ip:unknown',
      expect.any(Number),
      expect.any(String),
    );
  });

  it('rejects the request over the limit and removes that same sorted-set member', async () => {
    stubCount(51);
    const next = vi.fn();
    const res = createRes();

    await slidingWindowRateLimiter(createReq(), res, next as NextFunction);

    const member = pipeline.zadd.mock.calls[0]?.[2];
    expect(zrem).toHaveBeenCalledWith('ratelimit:ip:203.0.113.10', member);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.headers.get('Retry-After')).toBe(3600);
    expect(res.headers.get('X-RateLimit-Remaining')).toBe(0);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: 'RATE_LIMIT_EXCEEDED',
          limit: 50,
          remaining: 0,
        }),
      }),
    );
  });

  it('names the API key in the 429 message', async () => {
    stubCount(1001);
    const res = createRes();
    await slidingWindowRateLimiter(
      createReq({ apiKey: { id: 'key-1', name: 'app', tier: 'standard', rateLimit: 1000 } }),
      res,
      vi.fn() as NextFunction,
    );

    const body = res.body as { error: { message: string } };
    expect(body.error.message).toContain('API key rate limit exceeded (1000 requests/hour)');
  });

  it('fails open when the pipeline returns null', async () => {
    pipeline.exec.mockResolvedValue(null);
    const next = vi.fn();

    await slidingWindowRateLimiter(createReq(), createRes(), next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('fails open when Redis throws', async () => {
    pipeline.exec.mockRejectedValue(new Error('connection reset'));
    const next = vi.fn();

    await slidingWindowRateLimiter(createReq(), createRes(), next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('treats a non-numeric count as zero and allows the request', async () => {
    pipeline.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, null],
      [null, 1],
    ]);
    const next = vi.fn();

    await slidingWindowRateLimiter(createReq(), createRes(), next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });
});
