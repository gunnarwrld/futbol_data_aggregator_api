import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';

describe('health and routing', () => {
  it('returns process liveness without consuming the anonymous rate limit', async () => {
    let lastStatus = 0;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const response = await request(app).get('/health');
      lastStatus = response.status;
      expect(response.status).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    }

    const response = await request(app).get('/health');
    expect(lastStatus).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.timestamp).toEqual(expect.any(String));
    expect(response.body.data.uptime).toEqual(expect.any(Number));
  });

  it('returns the standard envelope for an unknown route', async () => {
    const response = await request(app).get('/api/v1/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: {
        message: 'Route GET /api/v1/does-not-exist not found',
        code: 'NOT_FOUND',
        statusCode: 404,
      },
    });
  });
});
