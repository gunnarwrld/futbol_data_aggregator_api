import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { strictRateLimiter } from '../../src/middleware/rateLimiter.js';

describe('strictRateLimiter', () => {
  const app = express();
  app.get('/sensitive', strictRateLimiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(errorHandler);

  it('allows the burst and then returns the AppError envelope', async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request(app).get('/sensitive');
      expect(response.status).toBe(200);
      expect(response.headers['ratelimit-limit']).toBe('10');
    }

    const blocked = await request(app).get('/sensitive');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      error: {
        message: 'Rate limit exceeded for this endpoint',
        code: 'TOO_MANY_REQUESTS',
        statusCode: 429,
      },
    });
  });
});
