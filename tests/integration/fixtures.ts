import { prisma } from '../../src/config/database.js';

export async function createLeague(
  overrides: Partial<{
    name: string;
    country: string;
    season: string;
    externalId: number;
  }> = {},
): Promise<{ id: string; name: string; country: string; season: string }> {
  return prisma.league.create({
    data: {
      name: overrides.name ?? 'Primeira Liga',
      country: overrides.country ?? 'Portugal',
      season: overrides.season ?? '2025/2026',
      ...(overrides.externalId !== undefined ? { externalId: overrides.externalId } : {}),
    },
  });
}

export async function createTeam(
  overrides: Partial<{
    name: string;
    shortName: string;
    stadium: string;
    externalId: number;
  }> = {},
): Promise<{ id: string; name: string }> {
  return prisma.team.create({
    data: {
      name: overrides.name ?? 'FC Porto',
      shortName: overrides.shortName ?? 'POR',
      stadium: overrides.stadium ?? 'Estádio do Dragão',
      ...(overrides.externalId !== undefined ? { externalId: overrides.externalId } : {}),
    },
  });
}

export async function createPlayer(teamId: string, name = 'Diogo Costa'): Promise<{ id: string }> {
  return prisma.player.create({
    data: {
      teamId,
      name,
      position: 'Goalkeeper',
      jerseyNumber: 99,
    },
  });
}

export async function createMatch(input: {
  leagueId: string;
  homeTeamId: string;
  awayTeamId: string;
  status?: string;
  matchDate?: Date;
  homeScore?: number;
  awayScore?: number;
}): Promise<{ id: string }> {
  return prisma.match.create({
    data: {
      leagueId: input.leagueId,
      homeTeamId: input.homeTeamId,
      awayTeamId: input.awayTeamId,
      status: input.status ?? 'SCHEDULED',
      matchDate: input.matchDate ?? new Date('2026-05-01T15:00:00.000Z'),
      homeScore: input.homeScore ?? 0,
      awayScore: input.awayScore ?? 0,
    },
  });
}
