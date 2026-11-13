import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { apiKeyHeader } from './fixtures.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000077';

describe('API key requirement', () => {
  it('keeps public reads anonymous', async () => {
    const paths = [
      '/health',
      '/api/v1/leagues',
      '/api/v1/teams',
      '/api/v1/matches',
      '/api/v1/matches/live',
      '/api/v1/players',
    ];

    for (const path of paths) {
      const response = await request(app).get(path);
      expect({ path, status: response.status }).toEqual({ path, status: 200 });
    }
  });

  it('rejects anonymous writes and key administration', async () => {
    const calls = [
      request(app).post('/api/v1/leagues').send({ name: 'L', country: 'P', season: '2025/2026' }),
      request(app).put(`/api/v1/leagues/${MISSING_ID}`).send({ name: 'L' }),
      request(app).delete(`/api/v1/leagues/${MISSING_ID}`),
      request(app).post('/api/v1/teams').send({ name: 'T', shortName: 'T', stadium: 'S' }),
      request(app).put(`/api/v1/teams/${MISSING_ID}`).send({ name: 'T' }),
      request(app).delete(`/api/v1/teams/${MISSING_ID}`),
      request(app).post('/api/v1/matches').send({}),
      request(app).put(`/api/v1/matches/${MISSING_ID}`).send({ status: 'LIVE' }),
      request(app).delete(`/api/v1/matches/${MISSING_ID}`),
      request(app).post('/api/v1/players').send({ name: 'P' }),
      request(app).put(`/api/v1/players/${MISSING_ID}`).send({ name: 'P' }),
      request(app).delete(`/api/v1/players/${MISSING_ID}`),
      request(app).get('/api/v1/api-keys'),
      request(app).post('/api/v1/api-keys').send({ name: 'Next' }),
      request(app).patch(`/api/v1/api-keys/${MISSING_ID}/revoke`),
    ];

    const responses = await Promise.all(calls);
    for (const response of responses) {
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('API_KEY_REQUIRED');
    }
  });

  it('rejects an invalid key on a write before treating it as anonymous', async () => {
    const response = await request(app)
      .post('/api/v1/leagues')
      .set('x-api-key', 'fda_not-real')
      .send({ name: 'L', country: 'P', season: '2025/2026' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_API_KEY');
  });

  it('rejects non-admin keys on every key administration route', async () => {
    const auth = await apiKeyHeader();
    const responses = await Promise.all([
      request(app).get('/api/v1/api-keys').set(auth),
      request(app).post('/api/v1/api-keys').set(auth).send({ name: 'Forbidden' }),
      request(app).patch(`/api/v1/api-keys/${MISSING_ID}/revoke`).set(auth),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('ADMIN_KEY_REQUIRED');
    }
  });

  it('allows a write with a valid key', async () => {
    const response = await request(app)
      .post('/api/v1/leagues')
      .set(await apiKeyHeader())
      .send({ name: 'Keyed League', country: 'Portugal', season: '2025/2026' });

    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Keyed League');
  });
});
