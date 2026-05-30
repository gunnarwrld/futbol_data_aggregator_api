import { prisma } from '../config/database.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Team, type Prisma } from '@prisma/client';

export const teamRepository = {
  async findAll(
    options: PaginationOptions,
    filters?: { name?: string },
  ): Promise<PaginatedResult<Team>> {
    const where: Prisma.TeamWhereInput = {};

    if (filters?.name) {
      where.name = { contains: filters.name, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      prisma.team.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { [options.sortBy]: options.sortOrder },
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

  async findById(id: string): Promise<Team | null> {
    return prisma.team.findUnique({
      where: { id },
    });
  },

  async findByExternalId(externalId: number): Promise<Team | null> {
    return prisma.team.findUnique({
      where: { externalId },
    });
  },

  async create(data: Prisma.TeamCreateInput): Promise<Team> {
    return prisma.team.create({ data });
  },

  async update(id: string, data: Prisma.TeamUpdateInput): Promise<Team> {
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

  async delete(id: string): Promise<Team> {
    return prisma.team.delete({ where: { id } });
  },
};
