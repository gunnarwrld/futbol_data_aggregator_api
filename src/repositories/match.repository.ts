import { prisma } from '../config/database.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Match, type Prisma } from '@prisma/client';

/**
 * Match Repository — Data Access Layer
 */
export const matchRepository = {
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
    const where: Prisma.MatchWhereInput = {};

    if (filters?.leagueId) where.leagueId = filters.leagueId;
    if (filters?.season) where.season = filters.season;
    if (filters?.status) where.status = filters.status;
    if (filters?.teamId) {
      where.OR = [
        { homeTeamId: filters.teamId },
        { awayTeamId: filters.teamId },
      ];
    }
    if (filters?.dateFrom ?? filters?.dateTo) {
      where.date = {};
      if (filters?.dateFrom) where.date.gte = filters.dateFrom;
      if (filters?.dateTo) where.date.lte = filters.dateTo;
    }

    const [data, total] = await Promise.all([
      prisma.match.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { [options.sortBy]: options.sortOrder },
        include: {
          league: true,
          homeTeam: true,
          awayTeam: true,
          venue: true,
        },
      }),
      prisma.match.count({ where }),
    ]);

    return {
      data,
      total,
      page: options.page,
      limit: options.limit,
      totalPages: Math.ceil(total / options.limit),
    };
  },

  async findById(id: number): Promise<Match | null> {
    return prisma.match.findUnique({
      where: { id },
      include: {
        league: true,
        homeTeam: true,
        awayTeam: true,
        venue: true,
        events: { orderBy: { elapsed: 'asc' } },
        statistics: true,
      },
    });
  },

  async findByExternalId(externalId: number): Promise<Match | null> {
    return prisma.match.findUnique({
      where: { externalId },
      include: { league: true, homeTeam: true, awayTeam: true },
    });
  },

  async findLive(): Promise<Match[]> {
    return prisma.match.findMany({
      where: {
        status: { in: ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'] },
      },
      include: { league: true, homeTeam: true, awayTeam: true, venue: true },
      orderBy: { date: 'asc' },
    });
  },

  async create(data: Prisma.MatchCreateInput): Promise<Match> {
    return prisma.match.create({ data });
  },

  async update(id: number, data: Prisma.MatchUpdateInput): Promise<Match> {
    return prisma.match.update({ where: { id }, data });
  },

  async upsertByExternalId(
    externalId: number,
    data: Prisma.MatchCreateInput,
  ): Promise<Match> {
    return prisma.match.upsert({
      where: { externalId },
      create: data,
      update: data,
    });
  },

  async delete(id: number): Promise<Match> {
    return prisma.match.delete({ where: { id } });
  },
};
