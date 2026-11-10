import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Team } from '@prisma/client';
import { teamRepository } from '../../src/repositories/team.repository.js';
import { teamService } from '../../src/services/team.service.js';
import { AppError } from '../../src/utils/AppError.js';

vi.mock('../../src/repositories/team.repository.js', () => ({
  teamRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByExternalId: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const team = { id: 'team-1', name: 'FC Porto' } as Team;
const repo = vi.mocked(teamRepository);

describe('teamService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws a not-found error for a missing team', async () => {
    repo.findById.mockResolvedValue(null);
    repo.findByExternalId.mockResolvedValue(null);

    await expect(teamService.findById('missing')).rejects.toMatchObject({
      message: "Team with id 'missing' not found",
    });
    await expect(teamService.findByExternalId(212)).rejects.toBeInstanceOf(AppError);
    await expect(teamService.update('missing', { name: 'X' })).rejects.toBeInstanceOf(AppError);
    await expect(teamService.delete('missing')).rejects.toBeInstanceOf(AppError);
    expect(repo.update).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('returns and writes a team through the repository', async () => {
    repo.findById.mockResolvedValue(team);
    repo.create.mockResolvedValue(team);
    repo.update.mockResolvedValue(team);

    await expect(teamService.findById('team-1')).resolves.toBe(team);
    await expect(
      teamService.create({ name: 'FC Porto', shortName: 'POR', stadium: 'Dragão' }),
    ).resolves.toBe(team);
    await expect(teamService.update('team-1', { stadium: 'Dragão' })).resolves.toBe(team);
    await teamService.delete('team-1');
    expect(repo.delete).toHaveBeenCalledWith('team-1');
  });
});
