import { apiFootball, isApiFootballAuthOrQuotaError } from '../integrations/apiFootball.js';
import { leagueRepository } from '../repositories/league.repository.js';
import { invalidateCache } from '../middleware/cache.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { type ApiFootballLeague, type ApiFootballResponse } from '../types/index.js';

/**
 * League Sync Service.
 *
 * Fetches each watched league from API-Football and upserts it into PostgreSQL.
 * Uses `externalId` for idempotent upserts — safe to run repeatedly
 * without creating duplicates.
 *
 * `SYNC_LEAGUE_IDS` limits the catalog. One `/leagues?id=` request is made
 * per configured id. An empty list skips the API entirely. A 403 or 429
 * stops the loop so the remaining ids are not requested.
 *
 * API-Football endpoint: GET /leagues?id={id}
 * Schedule: Every 24 hours (leagues rarely change mid-season)
 */
export const syncLeaguesService = {
  /**
   * Sync watched leagues from API-Football.
   *
   * @returns Summary of sync results
   */
  async syncAll(): Promise<{ synced: number; errors: number }> {
    const leagueIds = config.SYNC_LEAGUE_IDS;

    if (leagueIds.length === 0) {
      logger.info('Skipping league sync — SYNC_LEAGUE_IDS is empty');
      return { synced: 0, errors: 0 };
    }

    logger.info({ leagueIds }, 'Starting league sync from API-Football');

    let synced = 0;
    let errors = 0;

    for (const id of leagueIds) {
      let response: ApiFootballResponse<ApiFootballLeague>;

      try {
        response = await apiFootball.get<ApiFootballLeague>('/leagues', { id });
      } catch (err) {
        errors++;

        if (isApiFootballAuthOrQuotaError(err)) {
          logger.error(
            { err, leagueId: id },
            'Stopping league sync — API-Football returned 403 or 429',
          );
          break;
        }

        logger.error({ err, leagueId: id }, 'Failed to fetch league');
        continue;
      }

      const item = response.response.find((entry) => entry.league.id === id);

      if (!item) {
        logger.warn({ leagueId: id }, 'SYNC_LEAGUE_IDS entry was not returned by API-Football');
        errors++;
        continue;
      }

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

    logger.info({ total: leagueIds.length, synced, errors }, 'League sync completed');

    return { synced, errors };
  },
};
