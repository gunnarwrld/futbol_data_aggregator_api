import { apiFootball, isApiFootballAuthOrQuotaError } from '../integrations/apiFootball.js';
import { invalidateCache } from '../middleware/cache.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { getSocketIO } from '../config/socket.js';
import {
  LIVE_EMPTY_CATALOG_BACKOFF_MS,
  LIVE_IDLE_BACKOFF_MS,
  LIVE_KICKOFF_LOOKAHEAD_MS,
  LIVE_KICKOFF_LOOKBACK_MS,
  LIVE_UPSTREAM_BACKOFF_MS,
  livePollGate,
} from './livePollGate.js';
import {
  type ApiFootballFixture,
  type ApiFootballFixtureEvent,
  type ApiFootballResponse,
} from '../types/index.js';

/**
 * Map API-Football event types to our schema event types.
 */
const EVENT_TYPE_MAP: Record<string, string> = {
  Goal: 'GOAL',
  Card: 'CARD', // Further refined by detail (Yellow/Red)
  subst: 'SUBSTITUTION',
  Var: 'VAR',
};

/**
 * Refine card events into specific types based on the detail field.
 */
function mapEventType(type: string, detail: string): string {
  if (type === 'Card') {
    if (detail.toLowerCase().includes('yellow')) return 'YELLOW_CARD';
    if (detail.toLowerCase().includes('red')) return 'RED_CARD';
    return 'CARD';
  }
  return EVENT_TYPE_MAP[type] ?? type.toUpperCase();
}

/**
 * Live Match Sync Service.
 *
 * Fetches currently live fixtures from API-Football and updates
 * scores, statuses, and match events in real time.
 *
 * The BullMQ scheduler ticks every 60 seconds. This method skips the
 * API-Football request when:
 * - `SYNC_LEAGUE_IDS` is empty
 * - a backoff window is open (idle, empty database, or 403/429)
 * - none of the watched leagues are stored yet
 * - no watched match is `LIVE` or `SCHEDULED` inside the kickoff window
 *
 * A `LIVE` row whose kickoff is older than that window is not a reason to
 * call API-Football. `syncLive` only writes `LIVE` for fixtures still in the
 * live feed, so those rows would otherwise stay `LIVE` until the 6-hour
 * match sync. They are set to `FINISHED` locally first. An empty live
 * payload then cannot keep spending a request every 10 minutes, including
 * when that match sync stops on HTTP 429.
 *
 * When a request is made, `live` is the watched ids joined with hyphens
 * (`live=39-140-2`), not `live=all`.
 *
 * API-Football endpoints:
 * - GET /fixtures?live={id-id-id}
 * - GET /fixtures/events?fixture={id}
 *
 * Schedule: Every 60 seconds, with the skips above
 */
export interface LiveSyncResult {
  updated: number;
  events: number;
  errors: number;
  skipped: boolean;
}

export const syncLiveMatchesService = {
  /**
   * Sync currently live matches for watched leagues, and their events.
   *
   * @returns Summary of sync results. `skipped` means no API-Football request was made.
   */
  async syncLive(): Promise<LiveSyncResult> {
    const leagueIds = config.SYNC_LEAGUE_IDS;

    if (leagueIds.length === 0) {
      logger.info('Skipping live match sync — SYNC_LEAGUE_IDS is empty');
      return { updated: 0, events: 0, errors: 0, skipped: true };
    }

    if (livePollGate.shouldSkip()) {
      logger.debug('Skipping live match sync — backoff window');
      return { updated: 0, events: 0, errors: 0, skipped: true };
    }

    const leagues = await prisma.league.findMany({
      where: { externalId: { in: leagueIds } },
      select: { id: true },
    });

    if (leagues.length === 0) {
      livePollGate.backoff(LIVE_EMPTY_CATALOG_BACKOFF_MS);
      logger.info('Skipping live match sync — watched leagues are not in the database');
      return { updated: 0, events: 0, errors: 0, skipped: true };
    }

    const now = Date.now();
    const windowStart = new Date(now - LIVE_KICKOFF_LOOKBACK_MS);
    const windowEnd = new Date(now + LIVE_KICKOFF_LOOKAHEAD_MS);
    const watchedLeagueIds = leagues.map((league) => league.id);

    // Past the window a match cannot still be in progress. Close it here so
    // a stuck LIVE status cannot schedule another upstream request.
    const finishedStale = await prisma.match.updateMany({
      where: {
        leagueId: { in: watchedLeagueIds },
        status: 'LIVE',
        matchDate: { lt: windowStart },
      },
      data: { status: 'FINISHED' },
    });

    if (finishedStale.count > 0) {
      logger.info(
        { count: finishedStale.count },
        'Marked live matches past the kickoff window as finished',
      );
      await invalidateCache('matches:*');
    }

    const candidate = await prisma.match.findFirst({
      where: {
        leagueId: { in: watchedLeagueIds },
        status: { in: ['LIVE', 'SCHEDULED'] },
        matchDate: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true },
    });

    if (!candidate) {
      livePollGate.backoff(LIVE_IDLE_BACKOFF_MS);
      logger.debug('Skipping live match sync — no watched match is live or about to start');
      return { updated: 0, events: 0, errors: 0, skipped: true };
    }

    logger.info({ leagueIds }, 'Starting live match sync from API-Football');

    let response: ApiFootballResponse<ApiFootballFixture>;

    try {
      response = await apiFootball.get<ApiFootballFixture>('/fixtures', {
        live: leagueIds.join('-'),
      });
    } catch (err) {
      if (isApiFootballAuthOrQuotaError(err)) {
        livePollGate.backoff(LIVE_UPSTREAM_BACKOFF_MS);
        logger.error({ err }, 'Stopping live match sync — API-Football returned 403 or 429');
      }

      throw err;
    }

    const watchedIds = new Set(leagueIds);
    const liveFixtures = response.response.filter((item) => watchedIds.has(item.league.id));

    if (liveFixtures.length === 0) {
      livePollGate.backoff(LIVE_IDLE_BACKOFF_MS);
      logger.debug('No live fixtures found for watched leagues');
      return { updated: 0, events: 0, errors: 0, skipped: false };
    }

    livePollGate.clear();

    let updated = 0;
    let events = 0;
    let errors = 0;

    for (const item of liveFixtures) {
      try {
        // Find the match in our database by externalId
        const existingMatch = await prisma.match.findUnique({
          where: { externalId: item.fixture.id },
          select: { id: true, homeScore: true, awayScore: true, status: true },
        });

        if (!existingMatch) {
          logger.debug(
            { fixtureId: item.fixture.id },
            'Live fixture not tracked in our database — skipping',
          );
          continue;
        }

        const newHomeScore = item.goals.home ?? 0;
        const newAwayScore = item.goals.away ?? 0;
        const hasScoreChanged =
          existingMatch.homeScore !== newHomeScore ||
          existingMatch.awayScore !== newAwayScore ||
          existingMatch.status !== 'LIVE';

        // Update score and status
        const updatedMatch = await prisma.match.update({
          where: { id: existingMatch.id },
          data: {
            status: 'LIVE',
            homeScore: newHomeScore,
            awayScore: newAwayScore,
          },
        });

        // Broadcast score update if changed
        if (hasScoreChanged) {
          try {
            const io = getSocketIO();
            const payload = {
              matchId: updatedMatch.id,
              homeScore: newHomeScore,
              awayScore: newAwayScore,
              status: 'LIVE',
            };

            // Broadcast to specific match room
            io.to(`match:${updatedMatch.id}`).emit('match:update', payload);
            // Broadcast to global live matches room
            io.to('live-matches').emit('match:update', payload);

            logger.debug({ matchId: updatedMatch.id }, 'Broadcasted score update via Socket.io');
          } catch {
            logger.warn('Socket.io not initialized or failed to emit');
          }
        }

        updated++;

        // Fetch and sync match events (goals, cards, substitutions)
        try {
          const eventsResponse = await apiFootball.get<ApiFootballFixtureEvent>(
            '/fixtures/events',
            { fixture: item.fixture.id },
          );

          for (const event of eventsResponse.response) {
            try {
              // Resolve the team by externalId
              const team = await prisma.team.findUnique({
                where: { externalId: event.team.id },
                select: { id: true },
              });

              if (!team) continue;

              // Resolve the player by externalId (nullable)
              let playerId: string | null = null;
              if (event.player.id) {
                const player = await prisma.player.findUnique({
                  where: { externalId: event.player.id },
                  select: { id: true },
                });
                playerId = player?.id ?? null;
              }

              // Upsert event by match + team + minute + type to avoid duplicates
              const eventType = mapEventType(event.type, event.detail);

              // Check if this event already exists
              const existing = await prisma.matchEvent.findFirst({
                where: {
                  matchId: existingMatch.id,
                  teamId: team.id,
                  minute: event.time.elapsed,
                  eventType,
                },
              });

              if (!existing) {
                const newMatchEvent = await prisma.matchEvent.create({
                  data: {
                    matchId: existingMatch.id,
                    teamId: team.id,
                    playerId,
                    eventType,
                    minute: event.time.elapsed,
                  },
                });

                // Broadcast new event
                try {
                  const io = getSocketIO();
                  io.to(`match:${existingMatch.id}`).emit('match:event', newMatchEvent);
                  io.to('live-matches').emit('match:event', newMatchEvent);
                } catch {
                  logger.warn('Socket.io not initialized or failed to emit');
                }

                events++;
              }
            } catch (err) {
              logger.error(
                { err, fixtureId: item.fixture.id, event },
                'Failed to sync match event',
              );
              errors++;
            }
          }
        } catch (err) {
          if (isApiFootballAuthOrQuotaError(err)) {
            throw err;
          }

          logger.error(
            { err, fixtureId: item.fixture.id },
            'Failed to fetch events for live fixture',
          );
          errors++;
        }
      } catch (err) {
        if (isApiFootballAuthOrQuotaError(err)) {
          livePollGate.backoff(LIVE_UPSTREAM_BACKOFF_MS);
          logger.error(
            { err, fixtureId: item.fixture.id },
            'Stopping live match sync — API-Football returned 403 or 429',
          );
          throw err;
        }

        logger.error({ err, fixtureId: item.fixture.id }, 'Failed to sync live fixture');
        errors++;
      }
    }

    // Invalidate match and live match cache after sync
    await invalidateCache('matches:*');

    logger.info(
      { liveFixtures: liveFixtures.length, updated, events, errors },
      'Live match sync completed',
    );

    return { updated, events, errors, skipped: false };
  },
};
