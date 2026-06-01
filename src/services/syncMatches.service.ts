import { apiFootball } from '../integrations/apiFootball.js';
import { invalidateCache } from '../middleware/cache.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { type ApiFootballFixture } from '../types/index.js';

/**
 * API-Football fixture status → our schema status mapping.
 *
 * API-Football uses short codes like "NS", "1H", "FT".
 * We normalize these to our three canonical statuses.
 */
const STATUS_MAP: Record<string, string> = {
  // Not started
  TBD: 'SCHEDULED',
  NS: 'SCHEDULED',
  // In progress
  '1H': 'LIVE',
  HT: 'LIVE',
  '2H': 'LIVE',
  ET: 'LIVE',
  BT: 'LIVE',
  P: 'LIVE',
  SUSP: 'LIVE',
  INT: 'LIVE',
  LIVE: 'LIVE',
  // Finished
  FT: 'FINISHED',
  AET: 'FINISHED',
  PEN: 'FINISHED',
  // Cancelled / Postponed
  PST: 'SCHEDULED',
  CANC: 'FINISHED',
  ABD: 'FINISHED',
  AWD: 'FINISHED',
  WO: 'FINISHED',
};

/**
 * Match Sync Service.
 *
 * Fetches fixtures (matches) for each league from API-Football and
 * upserts them into PostgreSQL. Resolves team references by `externalId`.
 *
 * API-Football endpoint: GET /fixtures?league={id}&season={year}
 * Schedule: Every 6 hours (catches newly scheduled fixtures)
 */
export const syncMatchesService = {
  /**
   * Sync matches for all tracked leagues from API-Football.
   *
   * @returns Summary of sync results
   */
  async syncAll(): Promise<{ synced: number; errors: number }> {
    logger.info('Starting match sync from API-Football');

    const leagues = await prisma.league.findMany({
      where: { externalId: { not: null } },
      select: { id: true, externalId: true, season: true },
    });

    let synced = 0;
    let errors = 0;

    for (const league of leagues) {
      if (!league.externalId) continue;

      try {
        const seasonYear = Number(league.season.split('/')[0]) || new Date().getFullYear();

        const response = await apiFootball.get<ApiFootballFixture>('/fixtures', {
          league: league.externalId,
          season: seasonYear,
        });

        for (const item of response.response) {
          try {
            // Resolve home and away teams by their externalId
            const homeTeam = await prisma.team.findUnique({
              where: { externalId: item.teams.home.id },
              select: { id: true },
            });

            const awayTeam = await prisma.team.findUnique({
              where: { externalId: item.teams.away.id },
              select: { id: true },
            });

            if (!homeTeam || !awayTeam) {
              logger.warn(
                {
                  fixtureId: item.fixture.id,
                  homeExternalId: item.teams.home.id,
                  awayExternalId: item.teams.away.id,
                },
                'Skipping fixture — team(s) not found in database. Sync teams first.',
              );
              continue;
            }

            const status = STATUS_MAP[item.fixture.status.short] ?? 'SCHEDULED';

            await prisma.match.upsert({
              where: { externalId: item.fixture.id },
              create: {
                externalId: item.fixture.id,
                leagueId: league.id,
                homeTeamId: homeTeam.id,
                awayTeamId: awayTeam.id,
                matchDate: new Date(item.fixture.date),
                status,
                homeScore: item.goals.home ?? 0,
                awayScore: item.goals.away ?? 0,
              },
              update: {
                matchDate: new Date(item.fixture.date),
                status,
                homeScore: item.goals.home ?? 0,
                awayScore: item.goals.away ?? 0,
              },
            });

            synced++;
          } catch (err) {
            logger.error(
              { err, fixtureId: item.fixture.id },
              'Failed to sync fixture',
            );
            errors++;
          }
        }
      } catch (err) {
        logger.error(
          { err, leagueExternalId: league.externalId },
          'Failed to fetch fixtures for league',
        );
        errors++;
      }
    }

    // Invalidate match cache after successful sync
    await invalidateCache('matches:*');

    logger.info({ synced, errors }, 'Match sync completed');

    return { synced, errors };
  },
};
