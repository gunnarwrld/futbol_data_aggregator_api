import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/config/database.js';
import { app } from '../../src/app.js';
import { createLeague, createMatch, createTeam } from './fixtures.js';

async function seedMatch(status: string, minute?: number) {
  const league = await createLeague();
  const home = await createTeam({ name: `Home ${status}`, shortName: status.slice(0, 3) });
  const away = await createTeam({ name: `Away ${status}`, shortName: `A${status.slice(0, 2)}` });
  const match = await createMatch({
    leagueId: league.id,
    homeTeamId: home.id,
    awayTeamId: away.id,
    status,
    homeScore: status === 'FINISHED' ? 2 : 1,
    awayScore: 0,
  });
  if (minute !== undefined) {
    await prisma.matchEvent.create({
      data: {
        matchId: match.id,
        teamId: home.id,
        eventType: 'GOAL',
        minute,
      },
    });
  }
  return { match, home, away, league };
}

describe('matches API', () => {
  it('returns live, in-play, and paused matches with their latest events', async () => {
    await seedMatch('LIVE', 12);
    await seedMatch('IN_PLAY');
    await seedMatch('PAUSED');
    await seedMatch('FINISHED', 90);
    await seedMatch('SCHEDULED');

    const response = await request(app).get('/api/v1/matches/live');

    expect(response.status).toBe(200);
    expect(response.headers['x-cache']).toBe('MISS');
    const statuses = response.body.data.map((match: { status: string }) => match.status).sort();
    expect(statuses).toEqual(['IN_PLAY', 'LIVE', 'PAUSED']);
    const live = response.body.data.find((match: { status: string }) => match.status === 'LIVE');
    expect(live.events).toHaveLength(1);
    expect(live.homeTeam.shortName).toBe('LIV');
  });

  it('filters by team, status, and date and returns events in minute order', async () => {
    const league = await createLeague();
    const home = await createTeam({ name: 'FC Porto', shortName: 'POR' });
    const away = await createTeam({ name: 'SL Benfica', shortName: 'BEN' });
    const other = await createTeam({ name: 'SC Braga', shortName: 'SCB' });
    const included = await createMatch({
      leagueId: league.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      status: 'FINISHED',
      matchDate: new Date('2026-05-01T18:00:00.000Z'),
      homeScore: 2,
      awayScore: 1,
    });
    await createMatch({
      leagueId: league.id,
      homeTeamId: other.id,
      awayTeamId: away.id,
      status: 'SCHEDULED',
      matchDate: new Date('2026-06-01T18:00:00.000Z'),
    });
    await prisma.matchEvent.createMany({
      data: [
        { matchId: included.id, teamId: home.id, eventType: 'GOAL', minute: 40 },
        { matchId: included.id, teamId: away.id, eventType: 'GOAL', minute: 10 },
      ],
    });

    const list = await request(app).get(
      `/api/v1/matches?teamId=${home.id}&status=FINISHED&startDate=2026-05-01T00:00:00.000Z&endDate=2026-05-02T00:00:00.000Z`,
    );
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].homeScore).toBe(2);

    const detail = await request(app).get(`/api/v1/matches/${included.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.league.id).toBe(league.id);
    expect(detail.body.data.events.map((event: { minute: number }) => event.minute)).toEqual([
      10, 40,
    ]);
  });

  it('creates and updates a match through the HTTP API', async () => {
    const league = await createLeague();
    const home = await createTeam({ name: 'Home', shortName: 'HOM' });
    const away = await createTeam({ name: 'Away', shortName: 'AWY' });

    const created = await request(app).post('/api/v1/matches').send({
      leagueId: league.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      matchDate: '2026-05-10T19:00:00.000Z',
      status: 'SCHEDULED',
    });
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const updated = await request(app).put(`/api/v1/matches/${id}`).send({
      status: 'LIVE',
      homeScore: 1,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toEqual(expect.objectContaining({ status: 'LIVE', homeScore: 1 }));

    expect((await request(app).delete(`/api/v1/matches/${id}`)).status).toBe(204);
  });
});
