import { teamRepository } from '../repositories/team.repository.js';
import { AppError } from '../utils/AppError.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Team, type Prisma } from '@prisma/client';

export const teamService = {
  async findAll(
    options: PaginationOptions,
    filters?: { name?: string },
  ): Promise<PaginatedResult<Team>> {
    return teamRepository.findAll(options, filters);
  },

  async findById(id: string): Promise<Team> {
    const team = await teamRepository.findById(id);
    if (!team) throw AppError.notFound('Team', id);
    return team;
  },

  async findByExternalId(externalId: number): Promise<Team> {
    const team = await teamRepository.findByExternalId(externalId);
    if (!team) throw AppError.notFound('Team', externalId);
    return team;
  },

  async create(data: Prisma.TeamCreateInput): Promise<Team> {
    return teamRepository.create(data);
  },

  async update(id: string, data: Prisma.TeamUpdateInput): Promise<Team> {
    await teamService.findById(id);
    return teamRepository.update(id, data);
  },

  async delete(id: string): Promise<void> {
    await teamService.findById(id);
    await teamRepository.delete(id);
  },
};
