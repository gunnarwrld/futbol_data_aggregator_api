import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFootball } from '../../src/integrations/apiFootball.js';
import { invalidateCache } from '../../src/middleware/cache.js';
import { leagueRepository } from '../../src/repositories/league.repository.js';
import { syncLeaguesService } from '../../src/services/syncLeagues.service.js';

vi.mock('../../src/integrations/apiFootball.js', () => ({
  apiFootball: { get: vi.fn() },
}));

vi.mock('../../src/repositories/league.repository.js', () => ({
  leagueRepository: { upsertByExternalId: vi.fn() },
}));

vi.mock('../../src/middleware/cache.js', () => ({
  invalidateCache: vi.fn(),
  cacheMiddleware: vi.fn(),
}));

function league(id: number, name: string, seasons: { year: number; current: boolean }[]) {
  return {
    league: { id, name, type: 'League', logo: 'https://logo' },
    country: { name: 'Portugal', code: 'PT', flag: null },
    seasons: seasons.map((season) => ({
      year: season.year,
      start: `${season.year}-08-01`,
      end: `${season.year + 1}-05-01`,
      current: season.current,
    })),
  };
}

describe('syncLeaguesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invalidateCache).mockResolvedValue();
    vi.mocked(leagueRepository.upsertByExternalId).mockResolvedValue({} as never);
  });

  it('upserts the current season and invalidates the league cache', async () => {
    vi.mocked(apiFootball.get).mockResolvedValue({
      response: [
        league(94, 'Primeira Liga', [
          { year: 2024, current: false },
          { year: 2025, current: true },
        ]),
        league(95, 'Cup', []),
      ],
    } as Awaited<ReturnType<typeof apiFootball.get>>);

    const result = await syncLeaguesService.syncAll();

    expect(result).toEqual({ synced: 2, errors: 0 });
    expect(leagueRepository.upsertByExternalId).toHaveBeenNthCalledWith(1, 94, {
      externalId: 94,
      name: 'Primeira Liga',
      country: 'Portugal',
      season: '2025/2026',
    });
    expect(leagueRepository.upsertByExternalId).toHaveBeenNthCalledWith(2, 95, {
      externalId: 95,
      name: 'Cup',
      country: 'Portugal',
      season: 'Unknown',
    });
    expect(invalidateCache).toHaveBeenCalledWith('leagues:*');
  });

  it('counts a failed upsert and still clears the cache', async () => {
    vi.mocked(apiFootball.get).mockResolvedValue({
      response: [league(94, 'Primeira Liga', [{ year: 2025, current: true }])],
    } as Awaited<ReturnType<typeof apiFootball.get>>);
    vi.mocked(leagueRepository.upsertByExternalId).mockRejectedValue(new Error('unique'));

    await expect(syncLeaguesService.syncAll()).resolves.toEqual({ synced: 0, errors: 1 });
    expect(invalidateCache).toHaveBeenCalledWith('leagues:*');
  });
});
