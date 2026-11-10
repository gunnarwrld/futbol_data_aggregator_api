import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';
import { createPlayer, createTeam } from './fixtures.js';

const MISSING_ID = '00000000-0000-4000-8000-000000000088';

describe('teams API', () => {
  it('filters by name without case sensitivity', async () => {
    await createTeam({ name: 'FC Porto', shortName: 'POR' });
    await createTeam({ name: 'SL Benfica', shortName: 'BEN' });

    const response = await request(app).get('/api/v1/teams?name=porto');

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe('FC Porto');
  });

  it('creates, updates, and deletes a team', async () => {
    const created = await request(app).post('/api/v1/teams').send({
      name: 'Sporting CP',
      shortName: 'SCP',
      stadium: 'José Alvalade',
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const updated = await request(app).put(`/api/v1/teams/${id}`).send({ stadium: 'Alvalade' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.stadium).toBe('Alvalade');

    expect((await request(app).delete(`/api/v1/teams/${id}`)).status).toBe(204);
    expect((await request(app).get(`/api/v1/teams/${id}`)).status).toBe(404);
  });

  it('rejects deleting a team that still has players', async () => {
    const team = await createTeam();
    await createPlayer(team.id);

    const response = await request(app).delete(`/api/v1/teams/${team.id}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('FOREIGN_KEY_ERROR');
  });

  it('returns 404 for an unknown team', async () => {
    const response = await request(app).get(`/api/v1/teams/${MISSING_ID}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
