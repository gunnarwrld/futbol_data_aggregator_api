import { prisma } from '../config/database.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type League, type Prisma } from '@prisma/client';

/**
 * League Repository — Data Access Layer
 *
 * Handles all direct database interactions for League entities.
 * No business logic belongs here — only Prisma queries.
 */
export const leagueRepository = {
  /**
   * Find all leagues with pagination and optional filtering.
   */
  async findAll(
    options: PaginationOptions,
    filters?: { countryId?: number; season?: number; type?: string },
  ): Promise<PaginatedResult<League>> {
    const where: Prisma.LeagueWhereInput = {};

    if (filters?.countryId) where.countryId = filters.countryId;
    if (filters?.season) where.season = filters.season;
    if (filters?.type) where.type = filters.type;

    const [data, total] = await Promise.all([
      prisma.league.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { [options.sortBy]: options.sortOrder },
        include: { country: true },
      }),
      prisma.league.count({ where }),
    ]);

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  },

  /**
   * Find a single league by internal ID.
   */
  async findById(id: number): Promise<League | null> {
    return prisma.league.findUnique({
      where: { id },
      include: { country: true },
    });
  },

  /**
   * Find a single league by API-Football external ID.
   */
  async findByExternalId(externalId: number): Promise<League | null> {
    return prisma.league.findUnique({
      where: { externalId },
      include: { country: true },
    });
  },

  /**
   * Create a new league.
   */
  async create(data: Prisma.LeagueCreateInput): Promise<League> {
    return prisma.league.create({ data });
  },

  /**
   * Update an existing league.
   */
  async update(id: number, data: Prisma.LeagueUpdateInput): Promise<League> {
    return prisma.league.update({ where: { id }, data });
  },

  /**
   * Upsert a league by external ID (used during API-Football sync).
   */
  async upsertByExternalId(
    externalId: number,
    data: Prisma.LeagueCreateInput,
  ): Promise<League> {
    return prisma.league.upsert({
      where: { externalId },
      create: data,
      update: data,
    });
  },

  /**
   * Delete a league by ID.
   */
  async delete(id: number): Promise<League> {
    return prisma.league.delete({ where: { id } });
  },
};
