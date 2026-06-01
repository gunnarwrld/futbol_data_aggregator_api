import { apiFootball } from '../integrations/apiFootball.js';
import { leagueRepository } from '../repositories/league.repository.js';
import { invalidateCache } from '../middleware/cache.js';
import { logger } from '../config/logger.js';
import { type ApiFootballLeague } from '../types/index.js';

/**
 * League Sync Service.
 *
 * Fetches all leagues from API-Football and upserts them into PostgreSQL.
 * Uses `externalId` for idempotent upserts — safe to run repeatedly
 * without creating duplicates.
 *
 * API-Football endpoint: GET /leagues
 * Schedule: Every 24 hours (leagues rarely change mid-season)
 */
export const syncLeaguesService = {
  /**
   * Sync all leagues from API-Football.
   *
   * @returns Summary of sync results
   */
  async syncAll(): Promise<{ synced: number; errors: number }> {
    logger.info('Starting league sync from API-Football');

    const response = await apiFootball.get<ApiFootballLeague>('/leagues');
    const leagues = response.response;

    let synced = 0;
    let errors = 0;

    for (const item of leagues) {
      try {
        // Find the current season for this league
        const currentSeason = item.seasons.find((s) => s.current);
        const seasonYear = currentSeason
          ? `${currentSeason.year}/${currentSeason.year + 1}`
          : 'Unknown';

        await leagueRepository.upsertByExternalId(item.league.id, {
          externalId: item.league.id,
          name: item.league.name,
          country: item.country.name,
          season: seasonYear,
        });

        synced++;
      } catch (err) {
        logger.error(
          { err, leagueId: item.league.id, leagueName: item.league.name },
          'Failed to sync league',
        );
        errors++;
      }
    }

    // Invalidate league cache after successful sync
    await invalidateCache('leagues:*');

    logger.info(
      { total: leagues.length, synced, errors },
      'League sync completed',
    );

    return { synced, errors };
  },
};
