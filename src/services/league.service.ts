import { leagueRepository } from '../repositories/league.repository.js';
import { AppError } from '../utils/AppError.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type League, type Prisma } from '@prisma/client';

export const leagueService = {
  async findAll(
    options: PaginationOptions,
    filters?: { country?: string; season?: string },
  ): Promise<PaginatedResult<League>> {
    return leagueRepository.findAll(options, filters);
  },

  async findById(id: string): Promise<League> {
    const league = await leagueRepository.findById(id);
    if (!league) throw AppError.notFound('League', id);
    return league;
  },

  async findByExternalId(externalId: number): Promise<League> {
    const league = await leagueRepository.findByExternalId(externalId);
    if (!league) throw AppError.notFound('League', externalId);
    return league;
  },

  async create(data: Prisma.LeagueCreateInput): Promise<League> {
    return leagueRepository.create(data);
  },

  async update(id: string, data: Prisma.LeagueUpdateInput): Promise<League> {
    await leagueService.findById(id);
    return leagueRepository.update(id, data);
  },

  async delete(id: string): Promise<void> {
    await leagueService.findById(id);
    await leagueRepository.delete(id);
  },
};
