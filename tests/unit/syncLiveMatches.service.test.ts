import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/config/database.js';
import { getSocketIO } from '../../src/config/socket.js';
import { apiFootball } from '../../src/integrations/apiFootball.js';
import { invalidateCache } from '../../src/middleware/cache.js';
import { syncLiveMatchesService } from '../../src/services/syncLiveMatches.service.js';

const emit = vi.fn();
const to = vi.fn(() => ({ emit }));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    match: { findUnique: vi.fn(), update: vi.fn() },
    team: { findUnique: vi.fn() },
    player: { findUnique: vi.fn() },
    matchEvent: { findFirst: vi.fn(), create: vi.fn() },
  },
  disconnectDatabase: vi.fn(),
}));

vi.mock('../../src/integrations/apiFootball.js', () => ({
  apiFootball: { get: vi.fn() },
}));

vi.mock('../../src/middleware/cache.js', () => ({
  invalidateCache: vi.fn(),
  cacheMiddleware: vi.fn(),
}));

vi.mock('../../src/config/socket.js', () => ({
  getSocketIO: vi.fn(() => ({ to })),
}));

function liveFixture(id: number, home: number | null, away: number | null) {
  return {
    fixture: {
      id,
      referee: null,
      timezone: 'UTC',
      date: '2026-05-01T15:00:00+00:00',
      timestamp: 1,
      status: { long: 'First Half', short: '1H', elapsed: 30 },
    },
    league: {
      id: 94,
      name: 'Liga',
      country: 'Portugal',
      logo: '',
      flag: null,
      season: 2025,
      round: '1',
    },
    teams: {
      home: { id: 10, name: 'Porto', logo: '', winner: null },
      away: { id: 20, name: 'Benfica', logo: '', winner: null },
    },
    goals: { home, away },
  };
}

function event(type: string, detail: string, minute: number, playerId: number | null) {
  return {
    time: { elapsed: minute, extra: null },
    team: { id: 10, name: 'Porto', logo: '' },
    player: { id: playerId, name: playerId ? 'Pepe' : null },
    type,
    detail,
    comments: null,
  };
}

describe('syncLiveMatchesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    to.mockReturnValue({ emit });
    vi.mocked(getSocketIO).mockReturnValue({ to } as never);
    vi.mocked(invalidateCache).mockResolvedValue();
    vi.mocked(prisma.match.update).mockImplementation(async (args) => {
      const data = (
        args as { where: { id: string }; data: { homeScore: number; awayScore: number } }
      ).data;
      return { id: 'match-1', ...data, status: 'LIVE' } as Awaited<
        ReturnType<typeof prisma.match.update>
      >;
    });
    vi.mocked(prisma.team.findUnique).mockResolvedValue({ id: 'team-10' } as never);
    vi.mocked(prisma.player.findUnique).mockResolvedValue({ id: 'player-55' } as never);
    vi.mocked(prisma.matchEvent.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.matchEvent.create).mockImplementation(async (args) => {
      return { id: 'event-1', ...(args as { data: object }).data } as Awaited<
        ReturnType<typeof prisma.matchEvent.create>
      >;
    });
  });

  it('returns immediately when nothing is live and does not touch the cache', async () => {
    vi.mocked(apiFootball.get).mockResolvedValue({ response: [] } as Awaited<
      ReturnType<typeof apiFootball.get>
    >);

    await expect(syncLiveMatchesService.syncLive()).resolves.toEqual({
      updated: 0,
      events: 0,
      errors: 0,
    });
    expect(invalidateCache).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('skips fixtures that are not tracked and still clears the match cache', async () => {
    vi.mocked(apiFootball.get).mockResolvedValue({
      response: [liveFixture(50, 1, 0)],
    } as Awaited<ReturnType<typeof apiFootball.get>>);
    vi.mocked(prisma.match.findUnique).mockResolvedValue(null);

    await expect(syncLiveMatchesService.syncLive()).resolves.toEqual({
      updated: 0,
      events: 0,
      errors: 0,
    });
    expect(prisma.match.update).not.toHaveBeenCalled();
    expect(invalidateCache).toHaveBeenCalledWith('matches:*');
  });

  it('broadcasts a score change and a new event, then ignores a duplicate event', async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue({
      id: 'match-1',
      homeScore: 0,
      awayScore: 0,
      status: 'SCHEDULED',
    } as never);
    vi.mocked(apiFootball.get).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/fixtures') {
        return { response: [liveFixture(77, 1, 0)] } as Awaited<ReturnType<typeof apiFootball.get>>;
      }
      return {
        response: [
          event('Goal', 'Normal Goal', 18, 55),
          event('Card', 'Yellow Card', 23, 55),
          event('Card', 'Red Card', 40, null),
          event('Card', 'Manager card', 41, null),
          event('subst', 'Substitution 1', 60, 55),
          event('Var', 'Goal cancelled', 61, 55),
          event('Offside', 'Offside', 62, 999),
        ],
      } as Awaited<ReturnType<typeof apiFootball.get>>;
    });
    vi.mocked(prisma.player.findUnique).mockImplementation(async (args) => {
      const externalId = (args as { where: { externalId: number } }).where.externalId;
      if (externalId === 999) return null;
      return { id: 'player-55' } as Awaited<ReturnType<typeof prisma.player.findUnique>>;
    });
    vi.mocked(prisma.matchEvent.findFirst).mockImplementation(async (args) => {
      const eventType = (args as { where: { eventType: string } }).where.eventType;
      if (eventType === 'OFFSIDE') return { id: 'existing' } as never;
      return null;
    });

    const result = await syncLiveMatchesService.syncLive();

    expect(result).toEqual({ updated: 1, events: 6, errors: 0 });
    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { status: 'LIVE', homeScore: 1, awayScore: 0 },
    });
    expect(to).toHaveBeenCalledWith('match:match-1');
    expect(to).toHaveBeenCalledWith('live-matches');
    expect(emit).toHaveBeenCalledWith('match:update', {
      matchId: 'match-1',
      homeScore: 1,
      awayScore: 0,
      status: 'LIVE',
    });
    const created = vi.mocked(prisma.matchEvent.create).mock.calls.map((call) => {
      return (call[0] as { data: { eventType: string; playerId: string | null; minute: number } })
        .data;
    });
    expect(created.map((item) => item.eventType)).toEqual([
      'GOAL',
      'YELLOW_CARD',
      'RED_CARD',
      'CARD',
      'SUBSTITUTION',
      'VAR',
    ]);
    expect(created[2]?.playerId).toBeNull();
    expect(created[5]?.playerId).toBe('player-55');
    expect(emit).toHaveBeenCalledWith(
      'match:event',
      expect.objectContaining({ eventType: 'GOAL' }),
    );
  });

  it('does not broadcast when the score and live status are unchanged', async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue({
      id: 'match-1',
      homeScore: 1,
      awayScore: 0,
      status: 'LIVE',
    } as never);
    vi.mocked(apiFootball.get).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/fixtures') {
        return { response: [liveFixture(77, 1, 0)] } as Awaited<ReturnType<typeof apiFootball.get>>;
      }
      return { response: [] } as Awaited<ReturnType<typeof apiFootball.get>>;
    });

    await syncLiveMatchesService.syncLive();

    expect(emit).not.toHaveBeenCalled();
  });

  it('treats null goals as zero', async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue({
      id: 'match-1',
      homeScore: 0,
      awayScore: 0,
      status: 'LIVE',
    } as never);
    vi.mocked(apiFootball.get).mockImplementation(async (endpoint: string) => {
      if (endpoint === '/fixtures') {
        return { response: [liveFixture(77, null, null)] } as Awaited<
          ReturnType<typeof apiFootball.get>
        >;
      }
      return { response: [] } as Awaited<ReturnType<typeof apiFootball.get>>;
    });

    await syncLiveMatchesService.syncLive();

    expect(prisma.match.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ homeScore: 0, awayScore: 0 }) }),
    );
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps going when socket.io, an event team, or a downstream call fails', async () => {
    vi.mocked(prisma.match.findUnique)
      .mockResolvedValueOnce({ id: 'match-1', homeScore: 0, awayScore: 0, status: 'LIVE' } as never)
      .mockResolvedValueOnce({
        id: 'match-2',
        homeScore: 0,
        awayScore: 0,
        status: 'LIVE',
      } as never);
    vi.mocked(getSocketIO).mockImplementation(() => {
      throw new Error('socket not ready');
    });
    vi.mocked(apiFootball.get).mockImplementation(
      async (endpoint: string, params?: Record<string, string | number>) => {
        if (endpoint === '/fixtures') {
          return {
            response: [liveFixture(1, 2, 0), liveFixture(2, 0, 1)],
          } as Awaited<ReturnType<typeof apiFootball.get>>;
        }
        if (params?.fixture === 1) {
          return { response: [event('Goal', 'Normal Goal', 5, 55)] } as Awaited<
            ReturnType<typeof apiFootball.get>
          >;
        }
        throw new Error('events down');
      },
    );
    vi.mocked(prisma.team.findUnique).mockResolvedValueOnce(null);

    const result = await syncLiveMatchesService.syncLive();

    expect(result.updated).toBe(2);
    expect(result.events).toBe(0);
    expect(result.errors).toBe(1);
    expect(prisma.matchEvent.create).not.toHaveBeenCalled();
  });

  it('counts a failed fixture update', async () => {
    vi.mocked(prisma.match.findUnique).mockResolvedValue({
      id: 'match-1',
      homeScore: 0,
      awayScore: 0,
      status: 'LIVE',
    } as never);
    vi.mocked(apiFootball.get).mockResolvedValue({
      response: [liveFixture(1, 1, 0)],
    } as Awaited<ReturnType<typeof apiFootball.get>>);
    vi.mocked(prisma.match.update).mockRejectedValue(new Error('deadlock'));

    await expect(syncLiveMatchesService.syncLive()).resolves.toEqual({
      updated: 0,
      events: 0,
      errors: 1,
    });
  });
});
