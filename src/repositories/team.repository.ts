import { prisma } from '../config/database.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Team, type Prisma } from '@prisma/client';

/**
 * Team Repository — Data Access Layer
 */
export const teamRepository = {
  async findAll(
    options: PaginationOptions,
    filters?: { countryId?: number; national?: boolean; search?: string },
  ): Promise<PaginatedResult<Team>> {
    const where: Prisma.TeamWhereInput = {};

    if (filters?.countryId) where.countryId = filters.countryId;
    if (filters?.national !== undefined) where.national = filters.national;
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { [options.sortBy]: options.sortOrder },
        include: { country: true, venue: true },
      }),
      prisma.team.count({ where }),
    ]);

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  },

  async findById(id: number): Promise<Team | null> {
    return prisma.team.findUnique({
      where: { id },
      include: { country: true, venue: true, players: true },
    });
  },

  async findByExternalId(externalId: number): Promise<Team | null> {
    return prisma.team.findUnique({
      where: { externalId },
      include: { country: true, venue: true },
    });
  },

  async create(data: Prisma.TeamCreateInput): Promise<Team> {
    return prisma.team.create({ data });
  },

  async update(id: number, data: Prisma.TeamUpdateInput): Promise<Team> {
    return prisma.team.update({ where: { id }, data });
  },

  async upsertByExternalId(
    externalId: number,
    data: Prisma.TeamCreateInput,
  ): Promise<Team> {
    return prisma.team.upsert({
      where: { externalId },
      create: data,
      update: data,
    });
  },

  async delete(id: number): Promise<Team> {
    return prisma.team.delete({ where: { id } });
  },
};
