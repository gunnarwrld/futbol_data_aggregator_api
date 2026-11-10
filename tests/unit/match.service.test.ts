import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Match } from '@prisma/client';
import { matchRepository } from '../../src/repositories/match.repository.js';
import { matchService } from '../../src/services/match.service.js';
import { AppError } from '../../src/utils/AppError.js';

vi.mock('../../src/repositories/match.repository.js', () => ({
  matchRepository: {
    findAll: vi.fn(),
    findLiveMatches: vi.fn(),
    findById: vi.fn(),
    findByExternalId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const match = { id: 'match-1', status: 'LIVE' } as Match;
const repo = vi.mocked(matchRepository);

describe('matchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns live matches and throws for an unknown fixture', async () => {
    repo.findLiveMatches.mockResolvedValue([match]);
    repo.findById.mockResolvedValue(null);
    repo.findByExternalId.mockResolvedValue(null);

    await expect(matchService.findLiveMatches()).resolves.toEqual([match]);
    await expect(matchService.findById('missing')).rejects.toBeInstanceOf(AppError);
    await expect(matchService.findByExternalId(100)).rejects.toMatchObject({
      message: "Match with id '100' not found",
    });
    await expect(matchService.update('missing', { status: 'FINISHED' })).rejects.toBeInstanceOf(
      AppError,
    );
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('passes filters through and deletes only after the match exists', async () => {
    const filters = {
      leagueId: 'league-1',
      teamId: 'team-1',
      status: 'LIVE',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-05-02T00:00:00.000Z'),
    };
    repo.findAll.mockResolvedValue({ data: [match], total: 1, page: 1, limit: 20, totalPages: 1 });
    repo.findById.mockResolvedValue(match);

    await matchService.findAll(
      { page: 1, limit: 20, sortBy: 'matchDate', sortOrder: 'desc' },
      filters,
    );
    await matchService.delete('match-1');

    expect(repo.findAll).toHaveBeenCalledWith(
      { page: 1, limit: 20, sortBy: 'matchDate', sortOrder: 'desc' },
      filters,
    );
    expect(repo.delete).toHaveBeenCalledWith('match-1');
  });
});
