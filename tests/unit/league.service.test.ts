import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type League } from '@prisma/client';
import { leagueRepository } from '../../src/repositories/league.repository.js';
import { leagueService } from '../../src/services/league.service.js';
import { AppError } from '../../src/utils/AppError.js';

vi.mock('../../src/repositories/league.repository.js', () => ({
  leagueRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByExternalId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const league = { id: 'league-1', name: 'Primeira Liga' } as League;
const repo = vi.mocked(leagueRepository);

describe('leagueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a league and throws when it is missing', async () => {
    repo.findById.mockResolvedValueOnce(league).mockResolvedValueOnce(null);
    repo.findByExternalId.mockResolvedValueOnce(null);

    await expect(leagueService.findById('league-1')).resolves.toBe(league);
    await expect(leagueService.findById('missing')).rejects.toMatchObject({
      statusCode: 404,
      message: "League with id 'missing' not found",
    });
    await expect(leagueService.findByExternalId(94)).rejects.toBeInstanceOf(AppError);
  });

  it('refuses to update or delete a missing league', async () => {
    repo.findById.mockResolvedValue(null);

    await expect(leagueService.update('missing', { name: 'X' })).rejects.toBeInstanceOf(AppError);
    await expect(leagueService.delete('missing')).rejects.toBeInstanceOf(AppError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('delegates list, create, update, and delete to the repository', async () => {
    const page = { data: [league], total: 1, page: 1, limit: 20, totalPages: 1 };
    repo.findAll.mockResolvedValue(page);
    repo.findById.mockResolvedValue(league);
    repo.create.mockResolvedValue(league);
    repo.update.mockResolvedValue(league);

    await expect(
      leagueService.findAll(
        { page: 1, limit: 20, sortBy: 'name', sortOrder: 'asc' },
        { country: 'Portugal' },
      ),
    ).resolves.toBe(page);
    await expect(
      leagueService.create({ name: 'Liga', country: 'Portugal', season: '2025/2026' }),
    ).resolves.toBe(league);
    await expect(leagueService.update('league-1', { name: 'Liga NOS' })).resolves.toBe(league);
    await expect(leagueService.delete('league-1')).resolves.toBeUndefined();
    expect(repo.delete).toHaveBeenCalledWith('league-1');
  });
});
