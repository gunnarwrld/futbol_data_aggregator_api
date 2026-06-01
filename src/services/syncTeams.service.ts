import { apiFootball } from '../integrations/apiFootball.js';
import { teamRepository } from '../repositories/team.repository.js';
import { invalidateCache } from '../middleware/cache.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { type ApiFootballTeam } from '../types/index.js';

/**
 * Team Sync Service.
 *
 * Fetches teams for each league from API-Football and upserts them into PostgreSQL.
 * Iterates over all leagues in the database that have an `externalId`,
 * so leagues must be synced first.
 *
 * API-Football endpoint: GET /teams?league={id}&season={year}
 * Schedule: Every 24 hours
 */
export const syncTeamsService = {
  /**
   * Sync teams for all tracked leagues from API-Football.
   *
   * @returns Summary of sync results
   */
  async syncAll(): Promise<{ synced: number; errors: number }> {
    logger.info('Starting team sync from API-Football');

    // Fetch all leagues that have been synced from API-Football
    const leagues = await prisma.league.findMany({
      where: { externalId: { not: null } },
      select: { externalId: true, season: true },
    });

    let synced = 0;
    let errors = 0;

    for (const league of leagues) {
      if (!league.externalId) continue;

      try {
        // Extract the starting year from "2025/2026" → 2025
        const seasonYear = Number(league.season.split('/')[0]) || new Date().getFullYear();

        const response = await apiFootball.get<ApiFootballTeam>('/teams', {
          league: league.externalId,
          season: seasonYear,
        });

        for (const item of response.response) {
          try {
            await teamRepository.upsertByExternalId(item.team.id, {
              externalId: item.team.id,
              name: item.team.name,
              shortName: item.team.code ?? item.team.name.substring(0, 3).toUpperCase(),
              stadium: item.venue.name ?? 'Unknown',
            });

            synced++;
          } catch (err) {
            logger.error(
              { err, teamId: item.team.id, teamName: item.team.name },
              'Failed to sync team',
            );
            errors++;
          }
        }
      } catch (err) {
        logger.error(
          { err, leagueExternalId: league.externalId },
          'Failed to fetch teams for league',
        );
        errors++;
      }
    }

    // Invalidate team cache after successful sync
    await invalidateCache('teams:*');

    logger.info({ synced, errors }, 'Team sync completed');

    return { synced, errors };
  },
};
