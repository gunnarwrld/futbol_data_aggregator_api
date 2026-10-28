import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/config/database.js';
import { apiFootball } from '../../src/integrations/apiFootball.js';
import { invalidateCache } from '../../src/middleware/cache.js';
import { syncMatchesService } from '../../src/services/syncMatches.service.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    league: { findMany: vi.fn() },
    team: { findUnique: vi.fn() },
    match: { upsert: vi.fn() },
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

function fixture(
  id: number,
  status: string,
  home: number,
  away: number,
  goals: { home: number | null; away: number | null },
) {
  return {
    fixture: {
      id,
      referee: null,
      timezone: 'UTC',
      date: '2026-05-01T15:00:00+00:00',
      timestamp: 1,
      status: { long: status, short: status, elapsed: null },
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
      home: { id: home, name: 'Home', logo: '', winner: null },
      away: { id: away, name: 'Away', logo: '', winner: null },
    },
    goals,
  };
}

describe('syncMatchesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invalidateCache).mockResolvedValue();
    vi.mocked(prisma.league.findMany).mockResolvedValue([
      { id: 'league-1', externalId: 94, season: '2025/2026' },
    ] as Awaited<ReturnType<typeof prisma.league.findMany>>);
    vi.mocked(prisma.team.findUnique).mockImplementation(async (args) => {
      const externalId = (args as { where: { externalId: number } }).where.externalId;
      if (externalId === 404) return null;
      return { id: `team-${externalId}` } as Awaited<ReturnType<typeof prisma.team.findUnique>>;
    });
    vi.mocked(prisma.match.upsert).mockResolvedValue({} as never);
  });

  it('normalizes provider statuses, skips unknown teams, and stores null goals as zero', async () => {
    vi.mocked(apiFootball.get).mockResolvedValue({
      response: [
        fixture(1, 'NS', 10, 20, { home: null, away: null }),
        fixture(2, '1H', 10, 20, { home: 1, away: 0 }),
        fixture(3, 'FT', 10, 20, { home: 2, away: 2 }),
        fixture(4, 'CANC', 10, 20, { home: 0, away: 0 }),
        fixture(5, 'ZZZ', 10, 20, { home: 3, away: 1 }),
        fixture(6, 'LIVE', 10, 404, { home: 1, away: 1 }),
      ],
    } as Awaited<ReturnType<typeof apiFootball.get>>);

    const result = await syncMatchesService.syncAll();

    expect(result).toEqual({ synced: 5, errors: 0 });
    const statuses = vi.mocked(prisma.match.upsert).mock.calls.map((call) => {
      const arg = call[0] as { create: { externalId: number; status: string; homeScore: number } };
      return [arg.create.externalId, arg.create.status, arg.create.homeScore];
    });
    expect(statuses).toEqual([
      [1, 'SCHEDULED', 0],
      [2, 'LIVE', 1],
      [3, 'FINISHED', 2],
      [4, 'FINISHED', 0],
      [5, 'SCHEDULED', 3],
    ]);
    expect(invalidateCache).toHaveBeenCalledWith('matches:*');
  });

  it('counts a provider failure for a league and a failed upsert separately', async () => {
    vi.mocked(prisma.league.findMany).mockResolvedValue([
      { id: 'league-1', externalId: 94, season: 'bad' },
      { id: 'league-2', externalId: 95, season: '2024/2025' },
    ] as Awaited<ReturnType<typeof prisma.league.findMany>>);
    vi.mocked(apiFootball.get)
      .mockResolvedValueOnce({
        response: [fixture(8, 'HT', 10, 20, { home: 0, away: 0 })],
      } as Awaited<ReturnType<typeof apiFootball.get>>)
      .mockRejectedValueOnce(new Error('down'));
    vi.mocked(prisma.match.upsert).mockRejectedValue(new Error('conflict'));

    await expect(syncMatchesService.syncAll()).resolves.toEqual({ synced: 0, errors: 2 });
    expect(apiFootball.get).toHaveBeenCalledWith('/fixtures', {
      league: 94,
      season: new Date().getFullYear(),
    });
  });
});
