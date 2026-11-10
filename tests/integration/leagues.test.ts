import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { createLeague } from './fixtures.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000099';

describe('leagues API', () => {
  it('paginates, filters, and caps the page size', async () => {
    await createLeague({ name: 'Alpha', country: 'Portugal', season: '2025/2026' });
    await createLeague({ name: 'Beta', country: 'Spain', season: '2024/2025' });
    await createLeague({ name: 'Gamma', country: 'Portugal', season: '2025/2026' });

    const page = await request(app).get('/api/v1/leagues?page=1&limit=2&sortBy=name&sortOrder=asc');
    expect(page.status).toBe(200);
    expect(page.body.data.map((league: { name: string }) => league.name)).toEqual([
      'Alpha',
      'Beta',
    ]);
    expect(page.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });

    const second = await request(app).get(
      '/api/v1/leagues?page=2&limit=2&sortBy=name&sortOrder=asc',
    );
    expect(second.body.data).toHaveLength(1);
    expect(second.body.data[0].name).toBe('Gamma');

    const filtered = await request(app).get('/api/v1/leagues?country=Portugal&season=2025/2026');
    expect(filtered.body.data.map((league: { name: string }) => league.name).sort()).toEqual([
      'Alpha',
      'Gamma',
    ]);

    const capped = await request(app).get('/api/v1/leagues?limit=500&page=0');
    expect(capped.body.meta.page).toBe(1);
    expect(capped.body.meta.limit).toBe(100);
  });

  it('creates, reads, updates, and deletes a league', async () => {
    const created = await request(app).post('/api/v1/leagues').send({
      name: 'Primeira Liga',
      country: 'Portugal',
      season: '2025/2026',
      externalId: 94,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe('Primeira Liga');
    const id = created.body.data.id as string;

    const fetched = await request(app).get(`/api/v1/leagues/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.externalId).toBe(94);

    const updated = await request(app).put(`/api/v1/leagues/${id}`).send({ name: 'Liga Portugal' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Liga Portugal');

    const removed = await request(app).delete(`/api/v1/leagues/${id}`);
    expect(removed.status).toBe(204);
    expect(removed.text).toBe('');

    const missing = await request(app).get(`/api/v1/leagues/${id}`);
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  it('maps a duplicate external id to 409', async () => {
    await createLeague({ externalId: 94 });
    const response = await request(app).post('/api/v1/leagues').send({
      name: 'Other',
      country: 'Portugal',
      season: '2025/2026',
      externalId: 94,
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DUPLICATE_ENTRY');
    expect(response.body.error.message).toContain('externalId');
  });

  it('caches successful list responses and not 404s, then drops the cache on write', async () => {
    const first = await request(app).get('/api/v1/leagues');
    expect(first.headers['x-cache']).toBe('MISS');
    const second = await request(app).get('/api/v1/leagues');
    expect(second.headers['x-cache']).toBe('HIT');
    expect(second.body).toEqual(first.body);

    const missing = await request(app).get(`/api/v1/leagues/${MISSING_ID}`);
    expect(missing.status).toBe(404);
    expect(missing.headers['x-cache']).toBe('MISS');
    const missingAgain = await request(app).get(`/api/v1/leagues/${MISSING_ID}`);
    expect(missingAgain.status).toBe(404);
    expect(missingAgain.headers['x-cache']).toBe('MISS');

    await request(app).post('/api/v1/leagues').send({
      name: 'Serie A',
      country: 'Italy',
      season: '2025/2026',
    });
    const afterWrite = await request(app).get('/api/v1/leagues');
    expect(afterWrite.headers['x-cache']).toBe('MISS');
    expect(afterWrite.body.data).toHaveLength(1);
    expect(afterWrite.body.data[0].name).toBe('Serie A');
  });

  it('returns 404 when updating or deleting a missing league', async () => {
    const updated = await request(app).put(`/api/v1/leagues/${MISSING_ID}`).send({ name: 'Nope' });
    const removed = await request(app).delete(`/api/v1/leagues/${MISSING_ID}`);

    expect(updated.status).toBe(404);
    expect(removed.status).toBe(404);
  });
});
