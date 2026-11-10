import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    SYNC_LEAGUE_IDS: [39, 140, 2],
    API_FOOTBALL_KEY: 'test',
    API_FOOTBALL_BASE_URL: 'https://v3.football.api-sports.io',
  },
}));

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    league: { findMany: vi.fn() },
    match: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    team: { findUnique: vi.fn() },
    player: { findUnique: vi.fn() },
    matchEvent: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

vi.mock('../../src/middleware/cache.js', () => ({
  invalidateCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/repositories/league.repository.js', () => ({
  leagueRepository: {
    upsertByExternalId: vi.fn().mockResolvedValue({ id: 'league-1' }),
  },
}));

vi.mock('../../src/repositories/team.repository.js', () => ({
  teamRepository: {
    upsertByExternalId: vi.fn().mockResolvedValue({ id: 'team-1' }),
  },
}));

vi.mock('../../src/config/socket.js', () => ({
  getSocketIO: vi.fn(() => ({
    to: () => ({ emit: () => undefined }),
  })),
}));

vi.mock('../../src/integrations/apiFootball.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/integrations/apiFootball.js')>(
    '../../src/integrations/apiFootball.js',
  );

  return {
    ...actual,
    apiFootball: {
      get: vi.fn(),
    },
  };
});

import { config } from '../../src/config/index.js';
import { prisma } from '../../src/config/database.js';
import { apiFootball, ApiFootballRequestError } from '../../src/integrations/apiFootball.js';
import { invalidateCache } from '../../src/middleware/cache.js';
import { leagueRepository } from '../../src/repositories/league.repository.js';
import { LIVE_KICKOFF_LOOKBACK_MS, livePollGate } from '../../src/services/livePollGate.js';
import { syncLeaguesService } from '../../src/services/syncLeagues.service.js';
import { syncLiveMatchesService } from '../../src/services/syncLiveMatches.service.js';
import { syncMatchesService } from '../../src/services/syncMatches.service.js';
import { syncTeamsService } from '../../src/services/syncTeams.service.js';

function setLeagueIds(ids: number[]): void {
  (config as { SYNC_LEAGUE_IDS: number[] }).SYNC_LEAGUE_IDS = ids;
}

function leaguePayload(id: number, name: string) {
  return {
    league: { id, name, type: 'League', logo: '' },
    country: { name: 'Testland', code: null, flag: null },
    seasons: [{ year: 2025, start: '2025-08-01', end: '2026-05-01', current: true }],
  };
}

describe('sync quota', () => {
  beforeEach(() => {
    setLeagueIds([39, 140, 2]);
    livePollGate.clear();
    vi.mocked(apiFootball.get).mockReset();
    vi.mocked(prisma.league.findMany).mockReset();
    vi.mocked(prisma.match.findFirst).mockReset();
    vi.mocked(prisma.match.findUnique).mockReset();
    vi.mocked(prisma.match.updateMany).mockReset();
    vi.mocked(prisma.match.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(leagueRepository.upsertByExternalId).mockClear();
    vi.mocked(invalidateCache).mockClear();
  });

  describe('leagues', () => {
    it('requests only the configured league ids', async () => {
      vi.mocked(apiFootball.get).mockImplementation(async (_endpoint, params) => ({
        get: 'leagues',
        parameters: {},
        errors: [],
        results: 1,
        paging: { current: 1, total: 1 },
        response: [leaguePayload(Number(params?.['id'] ?? 0), 'League')],
      }));

      const result = await syncLeaguesService.syncAll();

      expect(apiFootball.get).toHaveBeenCalledTimes(3);
      expect(apiFootball.get).toHaveBeenNthCalledWith(1, '/leagues', { id: 39 });
      expect(apiFootball.get).toHaveBeenNthCalledWith(2, '/leagues', { id: 140 });
      expect(apiFootball.get).toHaveBeenNthCalledWith(3, '/leagues', { id: 2 });
      expect(leagueRepository.upsertByExternalId).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ synced: 3, errors: 0 });
    });

    it('makes no request when SYNC_LEAGUE_IDS is empty', async () => {
      setLeagueIds([]);

      const result = await syncLeaguesService.syncAll();

      expect(result).toEqual({ synced: 0, errors: 0 });
      expect(apiFootball.get).not.toHaveBeenCalled();
      expect(invalidateCache).not.toHaveBeenCalled();
    });

    it('stops after a 403 instead of requesting the remaining leagues', async () => {
      vi.mocked(apiFootball.get)
        .mockResolvedValueOnce({
          get: 'leagues',
          parameters: {},
          errors: [],
          results: 1,
          paging: { current: 1, total: 1 },
          response: [leaguePayload(39, 'Premier League')],
        })
        .mockRejectedValueOnce(new ApiFootballRequestError(403, 'Forbidden'));

      const result = await syncLeaguesService.syncAll();

      expect(apiFootball.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ synced: 1, errors: 1 });
    });
  });

  describe('teams and matches', () => {
    it('loads teams only for watched external ids and stops on 403', async () => {
      vi.mocked(prisma.league.findMany).mockResolvedValue([
        { externalId: 39, season: '2025/2026' },
        { externalId: 140, season: '2025/2026' },
      ] as never);
      vi.mocked(apiFootball.get).mockRejectedValue(
        new ApiFootballRequestError(429, 'Too Many Requests'),
      );

      const result = await syncTeamsService.syncAll();

      expect(prisma.league.findMany).toHaveBeenCalledWith({
        where: { externalId: { in: [39, 140, 2] } },
        select: { externalId: true, season: true },
      });
      expect(apiFootball.get).toHaveBeenCalledTimes(1);
      expect(apiFootball.get).toHaveBeenCalledWith('/teams', { league: 39, season: 2025 });
      expect(result.errors).toBe(1);
    });

    it('does not query Postgres or API-Football for teams when no leagues are configured', async () => {
      setLeagueIds([]);

      const result = await syncTeamsService.syncAll();

      expect(result).toEqual({ synced: 0, errors: 0 });
      expect(prisma.league.findMany).not.toHaveBeenCalled();
      expect(apiFootball.get).not.toHaveBeenCalled();
    });

    it('loads matches only for watched external ids', async () => {
      vi.mocked(prisma.league.findMany).mockResolvedValue([] as never);

      const result = await syncMatchesService.syncAll();

      expect(prisma.league.findMany).toHaveBeenCalledWith({
        where: { externalId: { in: [39, 140, 2] } },
        select: { id: true, externalId: true, season: true },
      });
      expect(apiFootball.get).not.toHaveBeenCalled();
      expect(result).toEqual({ synced: 0, errors: 0 });
    });

    it('does not sync matches when SYNC_LEAGUE_IDS is empty', async () => {
      setLeagueIds([]);

      await syncMatchesService.syncAll();

      expect(prisma.league.findMany).not.toHaveBeenCalled();
      expect(apiFootball.get).not.toHaveBeenCalled();
    });
  });

  describe('live fixtures', () => {
    it('skips the poll when no leagues are configured', async () => {
      setLeagueIds([]);

      const result = await syncLiveMatchesService.syncLive();

      expect(result.skipped).toBe(true);
      expect(prisma.league.findMany).not.toHaveBeenCalled();
      expect(apiFootball.get).not.toHaveBeenCalled();
    });

    it('does not call API-Football when the database has none of the watched leagues', async () => {
      vi.mocked(prisma.league.findMany).mockResolvedValue([] as never);

      const first = await syncLiveMatchesService.syncLive();
      const second = await syncLiveMatchesService.syncLive();

      expect(first.skipped).toBe(true);
      expect(second.skipped).toBe(true);
      expect(prisma.league.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.match.findFirst).not.toHaveBeenCalled();
      expect(apiFootball.get).not.toHaveBeenCalled();
    });

    it('does not call API-Football when nothing is live or about to start', async () => {
      vi.mocked(prisma.league.findMany).mockResolvedValue([{ id: 'league-1' }] as never);
      vi.mocked(prisma.match.findFirst).mockResolvedValue(null);

      const first = await syncLiveMatchesService.syncLive();
      const second = await syncLiveMatchesService.syncLive();

      expect(first.skipped).toBe(true);
      expect(second.skipped).toBe(true);
      expect(apiFootball.get).not.toHaveBeenCalled();
      expect(prisma.league.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.match.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.match.findFirst).toHaveBeenCalledWith({
        where: {
          leagueId: { in: ['league-1'] },
          status: { in: ['LIVE', 'SCHEDULED'] },
          matchDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        },
        select: { id: true },
      });
    });

    it('finishes a LIVE match outside the kickoff window without calling API-Football', async () => {
      vi.mocked(prisma.league.findMany).mockResolvedValue([{ id: 'league-1' }] as never);
      vi.mocked(prisma.match.updateMany).mockResolvedValue({ count: 1 } as never);
      vi.mocked(prisma.match.findFirst).mockResolvedValue(null);

      const first = await syncLiveMatchesService.syncLive();
      const second = await syncLiveMatchesService.syncLive();

      expect(first.skipped).toBe(true);
      expect(second.skipped).toBe(true);
      expect(apiFootball.get).not.toHaveBeenCalled();
      expect(prisma.match.updateMany).toHaveBeenCalledTimes(1);
      expect(invalidateCache).toHaveBeenCalledWith('matches:*');

      const update = vi.mocked(prisma.match.updateMany).mock.calls[0]?.[0] as {
        where: { leagueId: { in: string[] }; status: string; matchDate: { lt: Date } };
        data: { status: string };
      };
      expect(update.data).toEqual({ status: 'FINISHED' });
      expect(update.where.leagueId).toEqual({ in: ['league-1'] });
      expect(update.where.status).toBe('LIVE');
      const ageMs = Date.now() - update.where.matchDate.lt.getTime();
      expect(ageMs).toBeGreaterThan(LIVE_KICKOFF_LOOKBACK_MS - 5_000);
      expect(ageMs).toBeLessThan(LIVE_KICKOFF_LOOKBACK_MS + 5_000);
    });

    it('backs off after an empty live payload for the watched leagues', async () => {
      vi.mocked(prisma.league.findMany).mockResolvedValue([{ id: 'league-1' }] as never);
      vi.mocked(prisma.match.findFirst).mockResolvedValue({ id: 'match-1' } as never);
      vi.mocked(apiFootball.get).mockResolvedValue({
        get: 'fixtures',
        parameters: {},
        errors: [],
        results: 1,
        paging: { current: 1, total: 1 },
        response: [
          {
            fixture: { id: 99 },
            league: { id: 999 },
          },
        ],
      } as never);

      const first = await syncLiveMatchesService.syncLive();
      const second = await syncLiveMatchesService.syncLive();

      expect(first.skipped).toBe(false);
      expect(second.skipped).toBe(true);
      expect(apiFootball.get).toHaveBeenCalledTimes(1);
      expect(apiFootball.get).toHaveBeenCalledWith('/fixtures', { live: '39-140-2' });
      expect(prisma.match.findUnique).not.toHaveBeenCalled();
    });

    it('does not keep calling API-Football after a 403', async () => {
      vi.mocked(prisma.league.findMany).mockResolvedValue([{ id: 'league-1' }] as never);
      vi.mocked(prisma.match.findFirst).mockResolvedValue({ id: 'match-1' } as never);
      vi.mocked(apiFootball.get).mockRejectedValue(new ApiFootballRequestError(403, 'Forbidden'));

      await expect(syncLiveMatchesService.syncLive()).rejects.toThrow(/403/);

      vi.mocked(apiFootball.get).mockClear();
      const second = await syncLiveMatchesService.syncLive();

      expect(second.skipped).toBe(true);
      expect(apiFootball.get).not.toHaveBeenCalled();
    });
  });
});
