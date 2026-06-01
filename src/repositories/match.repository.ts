import { prisma } from '../config/database.js';
import { type PaginationOptions, type PaginatedResult } from '../types/index.js';
import { type Match, type Prisma } from '@prisma/client';

export const matchRepository = {
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
    const where: Prisma.MatchWhereInput = {};

    if (filters?.leagueId) where.leagueId = filters.leagueId;
    if (filters?.status) where.status = filters.status;

    if (filters?.teamId) {
      where.OR = [
        { homeTeamId: filters.teamId },
        { awayTeamId: filters.teamId },
      ];
    }

    if (filters?.startDate || filters?.endDate) {
      where.matchDate = {};
      if (filters?.startDate) where.matchDate.gte = filters.startDate;
      if (filters?.endDate) where.matchDate.lte = filters.endDate;
    }

    const [data, total] = await Promise.all([
      prisma.match.findMany({
        where,
        skip: (options.page - 1) * options.limit,
        take: options.limit,
        orderBy: { [options.sortBy]: options.sortOrder },
        include: {
          homeTeam: { select: { id: true, name: true, shortName: true } },
          awayTeam: { select: { id: true, name: true, shortName: true } },
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

  async findLiveMatches(): Promise<Match[]> {
    return prisma.match.findMany({
      where: {
        status: { in: ['LIVE', 'IN_PLAY', 'PAUSED'] }, // Adjust based on API-Football statuses
      },
      orderBy: { matchDate: 'desc' },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true } },
        awayTeam: { select: { id: true, name: true, shortName: true } },
        events: {
          orderBy: { minute: 'desc' },
          take: 5,
        },
      },
    });
  },

  async findById(id: string): Promise<Match | null> {
    return prisma.match.findUnique({
      where: { id },
      include: {
        league: true,
        homeTeam: true,
        awayTeam: true,
        events: {
          orderBy: { minute: 'asc' },
        },
      },
    });
  },

  async findByExternalId(externalId: number): Promise<Match | null> {
    return prisma.match.findUnique({
      where: { externalId },
    });
  },

  async create(data: Prisma.MatchCreateInput): Promise<Match> {
    return prisma.match.create({ data });
  },

  async update(id: string, data: Prisma.MatchUpdateInput): Promise<Match> {
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

  async delete(id: string): Promise<Match> {
    return prisma.match.delete({ where: { id } });
  },
};
