import { teamRepository } from '../repositories/team.repository.js';
import { AppError } from '../utils/AppError.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Team, type Prisma } from '@prisma/client';

/**
 * Team Service — Business Logic Layer
 */
export const teamService = {
  async findAll(
    options: PaginationOptions,
    filters?: { countryId?: number; national?: boolean; search?: string },
  ): Promise<PaginatedResult<Team>> {
    return teamRepository.findAll(options, filters);
  },

  async findById(id: number): Promise<Team> {
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

  async update(id: number, data: Prisma.TeamUpdateInput): Promise<Team> {
    await teamService.findById(id);
    return teamRepository.update(id, data);
  },

  async delete(id: number): Promise<void> {
    await teamService.findById(id);
    await teamRepository.delete(id);
  },
};
