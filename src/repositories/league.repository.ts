import { prisma } from '../config/database.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type League, type Prisma } from '@prisma/client';

export const leagueRepository = {
  async findAll(
    options: PaginationOptions,
    filters?: { country?: string; season?: string },
  ): Promise<PaginatedResult<League>> {
    const where: Prisma.LeagueWhereInput = {};

    if (filters?.country) where.country = filters.country;
    if (filters?.season) where.season = filters.season;

    const [data, total] = await Promise.all([
      prisma.league.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { [options.sortBy]: options.sortOrder },
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

  async findById(id: string): Promise<League | null> {
    return prisma.league.findUnique({
      where: { id },
    });
  },

  async findByExternalId(externalId: number): Promise<League | null> {
    return prisma.league.findUnique({
      where: { externalId },
    });
  },

  async create(data: Prisma.LeagueCreateInput): Promise<League> {
    return prisma.league.create({ data });
  },

  async update(id: string, data: Prisma.LeagueUpdateInput): Promise<League> {
    return prisma.league.update({ where: { id }, data });
  },

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

  async delete(id: string): Promise<League> {
    return prisma.league.delete({ where: { id } });
  },
};
