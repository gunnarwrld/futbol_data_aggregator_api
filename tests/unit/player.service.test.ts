import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Player } from '@prisma/client';
import { playerRepository } from '../../src/repositories/player.repository.js';
import { playerService } from '../../src/services/player.service.js';
import { AppError } from '../../src/utils/AppError.js';

vi.mock('../../src/repositories/player.repository.js', () => ({
  playerRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByExternalId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const player = { id: 'player-1', name: 'Diogo Costa' } as Player;
const repo = vi.mocked(playerRepository);

describe('playerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when the player does not exist', async () => {
    repo.findById.mockResolvedValue(null);
    repo.findByExternalId.mockResolvedValue(null);

    await expect(playerService.findById('missing')).rejects.toBeInstanceOf(AppError);
    await expect(playerService.findByExternalId(7)).rejects.toMatchObject({ statusCode: 404 });
    await expect(playerService.delete('missing')).rejects.toBeInstanceOf(AppError);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('delegates reads and writes', async () => {
    const page = { data: [player], total: 1, page: 1, limit: 20, totalPages: 1 };
    repo.findAll.mockResolvedValue(page);
    repo.findById.mockResolvedValue(player);
    repo.update.mockResolvedValue(player);

    await expect(
      playerService.findAll(
        { page: 1, limit: 20, sortBy: 'name', sortOrder: 'asc' },
        { teamId: 'team-1', position: 'Goalkeeper' },
      ),
    ).resolves.toBe(page);
    await expect(playerService.update('player-1', { jerseyNumber: 1 })).resolves.toBe(player);
    expect(repo.findById).toHaveBeenCalledWith('player-1');
  });
});
