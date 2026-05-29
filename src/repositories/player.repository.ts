import { prisma } from '../config/database.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Player, type Prisma } from '@prisma/client';

/**
 * Player Repository — Data Access Layer
 */
export const playerRepository = {
  async findAll(
    options: PaginationOptions,
    filters?: {
      teamId?: number;
      position?: string;
      nationality?: string;
      search?: string;
    },
  ): Promise<PaginatedResult<Player>> {
    const where: Prisma.PlayerWhereInput = {};

    if (filters?.teamId) where.teamId = filters.teamId;
    if (filters?.position) where.position = filters.position;
    if (filters?.nationality) where.nationality = filters.nationality;
    if (filters?.search) {
      where.name = { contains: filters.search, mode: 'insensitive' };
    }

    const [data, total] = await Promise.all([
      prisma.player.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { [options.sortBy]: options.sortOrder },
        include: { team: true },
      }),
      prisma.player.count({ where }),
    ]);

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  },

  async findById(id: number): Promise<Player | null> {
    return prisma.player.findUnique({
      where: { id },
      include: { team: true, statistics: true },
    });
  },

  async findByExternalId(externalId: number): Promise<Player | null> {
    return prisma.player.findUnique({
      where: { externalId },
      include: { team: true },
    });
  },

  async create(data: Prisma.PlayerCreateInput): Promise<Player> {
    return prisma.player.create({ data });
  },

  async update(id: number, data: Prisma.PlayerUpdateInput): Promise<Player> {
    return prisma.player.update({ where: { id }, data });
  },

  async upsertByExternalId(
    externalId: number,
    data: Prisma.PlayerCreateInput,
  ): Promise<Player> {
    return prisma.player.upsert({
      where: { externalId },
      create: data,
      update: data,
    });
  },

  async delete(id: number): Promise<Player> {
    return prisma.player.delete({ where: { id } });
  },
};
