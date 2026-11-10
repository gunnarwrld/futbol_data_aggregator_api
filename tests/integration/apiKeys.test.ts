import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { redis } from '../../src/config/redis.js';
import { prisma } from '../../src/config/database.js';
import { app } from '../../src/app.js';
import { apiKeyService } from '../../src/services/apiKey.service.js';

describe('API keys', () => {
  it('creates a key once, lists it without the secret, and revokes it', async () => {
    const created = await request(app).post('/api/v1/api-keys').send({
      name: 'Mobile App',
      tier: 'standard',
    });

    expect(created.status).toBe(201);
    expect(created.body.data.rawKey).toMatch(/^fda_[0-9a-f]{64}$/);
    expect(created.body.data.apiKey.prefix).toBe(created.body.data.rawKey.slice(0, 12));
    expect(created.body.data.apiKey.rateLimit).toBe(1000);
    expect(created.body.meta.warning).toContain('will NOT be shown again');
    const rawKey = created.body.data.rawKey as string;
    const id = created.body.data.apiKey.id as string;

    const listed = await request(app).get('/api/v1/api-keys');
    expect(listed.status).toBe(200);
    expect(listed.body.data[0].hashedKey).toBeUndefined();
    expect(JSON.stringify(listed.body)).not.toContain(rawKey);

    const authed = await request(app).get('/api/v1/leagues').set('x-api-key', rawKey);
    expect(authed.status).toBe(200);
    expect(authed.headers['x-ratelimit-limit']).toBe('1000');
    await vi.waitFor(async () => {
      const row = await prisma.apiKey.findUniqueOrThrow({ where: { id } });
      expect(row.lastUsedAt).not.toBeNull();
    });

    const revoked = await request(app).patch(`/api/v1/api-keys/${id}/revoke`);
    expect(revoked.status).toBe(200);
    expect(revoked.body.data.isActive).toBe(false);

    const afterRevoke = await request(app).get('/api/v1/leagues').set('x-api-key', rawKey);
    expect(afterRevoke.status).toBe(401);
    expect(afterRevoke.body.error.code).toBe('INVALID_API_KEY');
  });

  it('requires a name and stores premium and custom limits', async () => {
    const missing = await request(app).post('/api/v1/api-keys').send({ tier: 'premium' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('BAD_REQUEST');

    const premium = await request(app)
      .post('/api/v1/api-keys')
      .send({ name: 'Premium', tier: 'premium' });
    expect(premium.status).toBe(201);
    expect(premium.body.data.apiKey.rateLimit).toBe(5000);

    const custom = await request(app)
      .post('/api/v1/api-keys')
      .send({ name: 'Custom', tier: 'standard', rateLimit: 25 });
    expect(custom.body.data.apiKey.rateLimit).toBe(25);
  });

  it('rejects an unknown key and an expired key', async () => {
    const unknown = await request(app).get('/api/v1/leagues').set('x-api-key', 'fda_not-real');
    expect(unknown.status).toBe(401);

    const expired = await apiKeyService.create({
      name: 'Expired',
      expiresAt: new Date(Date.now() - 60_000),
    });
    const response = await request(app).get('/api/v1/leagues').set('x-api-key', expired.rawKey);
    expect(response.status).toBe(401);
  });

  it('enforces a key limit in Redis and does not keep the rejected request', async () => {
    const created = await apiKeyService.create({ name: 'Tight', rateLimit: 2 });

    const first = await request(app).get('/api/v1/leagues').set('x-api-key', created.rawKey);
    const second = await request(app).get('/api/v1/leagues').set('x-api-key', created.rawKey);
    const third = await request(app).get('/api/v1/leagues').set('x-api-key', created.rawKey);

    expect(first.status).toBe(200);
    expect(first.headers['x-ratelimit-limit']).toBe('2');
    expect(first.headers['x-ratelimit-remaining']).toBe('1');
    expect(second.status).toBe(200);
    expect(second.headers['x-ratelimit-remaining']).toBe('0');
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(third.headers['retry-after']).toBe('3600');

    const count = await redis.zcard(`ratelimit:apikey:${created.apiKey.id}`);
    expect(count).toBe(2);
  });

  it('advertises the anonymous hourly limit', async () => {
    const response = await request(app).get('/api/v1/leagues');

    expect(response.status).toBe(200);
    expect(response.headers['x-ratelimit-limit']).toBe('50');
    expect(response.headers['x-ratelimit-remaining']).toBe('49');
  });
});
