import { matchRepository } from '../repositories/match.repository.js';
import { AppError } from '../utils/AppError.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Match, type Prisma } from '@prisma/client';

export const matchService = {
  async findAll(
    options: PaginationOptions,
    filters?: {
      leagueId?: string;
      teamId?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<PaginatedResult<Match>> {
    return matchRepository.findAll(options, filters);
  },

  async findLiveMatches(): Promise<Match[]> {
    return matchRepository.findLiveMatches();
  },

  async findById(id: string): Promise<Match> {
    const match = await matchRepository.findById(id);
    if (!match) throw AppError.notFound('Match', id);
    return match;
  },

  async findByExternalId(externalId: number): Promise<Match> {
    const match = await matchRepository.findByExternalId(externalId);
    if (!match) throw AppError.notFound('Match', externalId);
    return match;
  },

  async create(data: Prisma.MatchCreateInput): Promise<Match> {
    return matchRepository.create(data);
  },

  async update(id: string, data: Prisma.MatchUpdateInput): Promise<Match> {
    await matchService.findById(id);
    return matchRepository.update(id, data);
  },

  async delete(id: string): Promise<void> {
    await matchService.findById(id);
    await matchRepository.delete(id);
  },
};
