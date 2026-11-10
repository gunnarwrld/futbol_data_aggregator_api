import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type NextFunction, type Request, type Response } from 'express';
import { apiKeyService } from '../../src/services/apiKey.service.js';
import { authenticateApiKey } from '../../src/middleware/authenticateApiKey.js';

vi.mock('../../src/services/apiKey.service.js', () => ({
  apiKeyService: {
    validate: vi.fn(),
  },
}));

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

describe('authenticateApiKey', () => {
  const validate = vi.mocked(apiKeyService.validate);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continues anonymously when no key is provided', async () => {
    const next = vi.fn();
    const req = { headers: {} } as Request;

    await authenticateApiKey(req, createRes(), next as NextFunction);

    expect(validate).not.toHaveBeenCalled();
    expect(req.apiKey).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it('ignores a non-string header and stays anonymous', async () => {
    const next = vi.fn();
    const req = { headers: { 'x-api-key': ['fda_a', 'fda_b'] } } as unknown as Request;

    await authenticateApiKey(req, createRes(), next as NextFunction);

    expect(validate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects an invalid, expired, or revoked key', async () => {
    validate.mockResolvedValue(null);
    const next = vi.fn();
    const res = createRes();
    const req = { headers: { 'x-api-key': 'fda_missing' } } as unknown as Request;

    await authenticateApiKey(req, res, next as NextFunction);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: {
        message: 'Invalid, expired, or revoked API key',
        code: 'INVALID_API_KEY',
        statusCode: 401,
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches the key tier and limit for a valid key', async () => {
    validate.mockResolvedValue({
      id: 'key-1',
      name: 'Mobile',
      tier: 'premium',
      rateLimit: 5000,
    } as Awaited<ReturnType<typeof apiKeyService.validate>>);
    const next = vi.fn();
    const req = { headers: { 'x-api-key': 'fda_valid' } } as unknown as Request;

    await authenticateApiKey(req, createRes(), next as NextFunction);

    expect(req.apiKey).toEqual({
      id: 'key-1',
      name: 'Mobile',
      tier: 'premium',
      rateLimit: 5000,
    });
    expect(next).toHaveBeenCalledOnce();
  });

  it('fails open without granting a tier when validation throws', async () => {
    validate.mockRejectedValue(new Error('database down'));
    const next = vi.fn();
    const req = { headers: { 'x-api-key': 'fda_valid' } } as unknown as Request;
    const res = createRes();

    await authenticateApiKey(req, res, next as NextFunction);

    expect(req.apiKey).toBeUndefined();
    expect(res.statusCode).toBe(0);
    expect(next).toHaveBeenCalledOnce();
  });
});
