import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/config/database.js';
import { app } from '../../src/app.js';
import { createPlayer, createTeam } from './fixtures.js';

describe('players API', () => {
  it('filters by team and position and includes the team on lookup', async () => {
    const porto = await createTeam({ name: 'FC Porto', shortName: 'POR' });
    const benfica = await createTeam({ name: 'SL Benfica', shortName: 'BEN' });
    await createPlayer(porto.id, 'Diogo Costa');
    await prisma.player.create({
      data: { teamId: benfica.id, name: 'Striker', position: 'Forward', jerseyNumber: 9 },
    });

    const byTeam = await request(app).get(`/api/v1/players?teamId=${porto.id}`);
    expect(byTeam.status).toBe(200);
    expect(byTeam.body.data).toHaveLength(1);
    expect(byTeam.body.data[0].name).toBe('Diogo Costa');

    const byPosition = await request(app).get('/api/v1/players?position=Forward');
    expect(byPosition.body.data).toHaveLength(1);
    expect(byPosition.body.data[0].name).toBe('Striker');

    const detail = await request(app).get(`/api/v1/players/${byTeam.body.data[0].id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.team.name).toBe('FC Porto');
  });

  it('creates, updates, and deletes a player', async () => {
    const team = await createTeam();
    const created = await request(app).post('/api/v1/players').send({
      teamId: team.id,
      name: 'Pepe',
      position: 'Defender',
      jerseyNumber: 3,
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const updated = await request(app).put(`/api/v1/players/${id}`).send({ jerseyNumber: 33 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.jerseyNumber).toBe(33);

    expect((await request(app).delete(`/api/v1/players/${id}`)).status).toBe(204);
    expect((await request(app).get(`/api/v1/players/${id}`)).status).toBe(404);
  });
});
