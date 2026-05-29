import { matchRepository } from '../repositories/match.repository.js';
import { AppError } from '../utils/AppError.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Match, type Prisma } from '@prisma/client';

/**
 * Match Service — Business Logic Layer
 */
export const matchService = {
  async findAll(
    options: PaginationOptions,
    filters?: {
      leagueId?: number;
      season?: number;
      teamId?: number;
      status?: string;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<PaginatedResult<Match>> {
    return matchRepository.findAll(options, filters);
  },

  async findById(id: number): Promise<Match> {
    const match = await matchRepository.findById(id);
    if (!match) throw AppError.notFound('Match', id);
    return match;
  },

  async findByExternalId(externalId: number): Promise<Match> {
    const match = await matchRepository.findByExternalId(externalId);
    if (!match) throw AppError.notFound('Match', externalId);
    return match;
  },

  /**
   * Get all currently live matches.
   * These are cached with short TTL (30s) in the route layer.
   */
  async findLive(): Promise<Match[]> {
    return matchRepository.findLive();
  },

  async create(data: Prisma.MatchCreateInput): Promise<Match> {
    return matchRepository.create(data);
  },

  async update(id: number, data: Prisma.MatchUpdateInput): Promise<Match> {
    await matchService.findById(id);
    return matchRepository.update(id, data);
  },

  async delete(id: number): Promise<void> {
    await matchService.findById(id);
    await matchRepository.delete(id);
  },
};
