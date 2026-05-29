import { leagueRepository } from '../repositories/league.repository.js';
import { AppError } from '../utils/AppError.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type League, type Prisma } from '@prisma/client';

/**
 * League Service — Business Logic Layer
 *
 * Orchestrates business rules and data transformations for League entities.
 * This layer sits between controllers (HTTP) and repositories (database).
 *
 * Rules enforced here:
 * - Input validation beyond schema (business rules)
 * - Entity existence checks
 * - Cross-entity coordination
 * - Cache invalidation triggers
 */
export const leagueService = {
  /**
   * Retrieve all leagues with pagination and optional filters.
   */
  async findAll(
    options: PaginationOptions,
    filters?: { countryId?: number; season?: number; type?: string },
  ): Promise<PaginatedResult<League>> {
    return leagueRepository.findAll(options, filters);
  },

  /**
   * Retrieve a single league by ID.
   * Throws 404 if not found.
   */
  async findById(id: number): Promise<League> {
    const league = await leagueRepository.findById(id);

    if (!league) {
      throw AppError.notFound('League', id);
    }

    return league;
  },

  /**
   * Retrieve a single league by API-Football external ID.
   * Throws 404 if not found.
   */
  async findByExternalId(externalId: number): Promise<League> {
    const league = await leagueRepository.findByExternalId(externalId);

    if (!league) {
      throw AppError.notFound('League', externalId);
    }

    return league;
  },

  /**
   * Create a new league.
   */
  async create(data: Prisma.LeagueCreateInput): Promise<League> {
    return leagueRepository.create(data);
  },

  /**
   * Update an existing league. Throws 404 if not found.
   */
  async update(id: number, data: Prisma.LeagueUpdateInput): Promise<League> {
    // Verify existence before updating
    await leagueService.findById(id);
    return leagueRepository.update(id, data);
  },

  /**
   * Delete a league. Throws 404 if not found.
   */
  async delete(id: number): Promise<void> {
    await leagueService.findById(id);
    await leagueRepository.delete(id);
  },
};
