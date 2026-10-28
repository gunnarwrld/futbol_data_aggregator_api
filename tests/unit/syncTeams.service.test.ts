import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/config/database.js';
import { apiFootball } from '../../src/integrations/apiFootball.js';
import { invalidateCache } from '../../src/middleware/cache.js';
import { teamRepository } from '../../src/repositories/team.repository.js';
import { syncTeamsService } from '../../src/services/syncTeams.service.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: { league: { findMany: vi.fn() } },
  disconnectDatabase: vi.fn(),
}));

vi.mock('../../src/integrations/apiFootball.js', () => ({
  apiFootball: { get: vi.fn() },
}));

vi.mock('../../src/repositories/team.repository.js', () => ({
  teamRepository: { upsertByExternalId: vi.fn() },
}));

vi.mock('../../src/middleware/cache.js', () => ({
  invalidateCache: vi.fn(),
  cacheMiddleware: vi.fn(),
}));

function team(id: number, name: string, code: string | null, venue: string | null) {
  return {
    team: { id, name, code, country: 'Portugal', founded: null, national: false, logo: '' },
    venue: {
      id: null,
      name: venue,
      address: null,
      city: null,
      capacity: null,
      surface: null,
      image: null,
    },
  };
}

describe('syncTeamsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invalidateCache).mockResolvedValue();
    vi.mocked(teamRepository.upsertByExternalId).mockResolvedValue({} as never);
  });

  it('derives the season year, short name, and stadium', async () => {
    vi.mocked(prisma.league.findMany).mockResolvedValue([
      { externalId: 94, season: '2025/2026' },
      { externalId: null, season: 'Unknown' },
    ] as Awaited<ReturnType<typeof prisma.league.findMany>>);
    vi.mocked(apiFootball.get).mockResolvedValue({
      response: [
        team(212, 'FC Porto', 'POR', 'Estádio do Dragão'),
        team(211, 'benfica', null, null),
      ],
    } as Awaited<ReturnType<typeof apiFootball.get>>);

    const result = await syncTeamsService.syncAll();

    expect(result).toEqual({ synced: 2, errors: 0 });
    expect(apiFootball.get).toHaveBeenCalledWith('/teams', { league: 94, season: 2025 });
    expect(teamRepository.upsertByExternalId).toHaveBeenCalledWith(212, {
      externalId: 212,
      name: 'FC Porto',
      shortName: 'POR',
      stadium: 'Estádio do Dragão',
    });
    expect(teamRepository.upsertByExternalId).toHaveBeenCalledWith(211, {
      externalId: 211,
      name: 'benfica',
      shortName: 'BEN',
      stadium: 'Unknown',
    });
    expect(invalidateCache).toHaveBeenCalledWith('teams:*');
  });

  it('falls back to the current year and counts fetch and upsert failures', async () => {
    vi.mocked(prisma.league.findMany).mockResolvedValue([
      { externalId: 1, season: 'Unknown' },
      { externalId: 2, season: '2024/2025' },
    ] as Awaited<ReturnType<typeof prisma.league.findMany>>);
    vi.mocked(apiFootball.get)
      .mockResolvedValueOnce({ response: [team(9, 'Odd', 'ODD', 'Ground')] } as Awaited<
        ReturnType<typeof apiFootball.get>
      >)
      .mockRejectedValueOnce(new Error('timeout'));
    vi.mocked(teamRepository.upsertByExternalId).mockRejectedValue(new Error('write'));

    const result = await syncTeamsService.syncAll();

    expect(apiFootball.get).toHaveBeenCalledWith('/teams', {
      league: 1,
      season: new Date().getFullYear(),
    });
    expect(result).toEqual({ synced: 0, errors: 2 });
    expect(invalidateCache).toHaveBeenCalledWith('teams:*');
  });
});
