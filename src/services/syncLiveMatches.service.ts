import { apiFootball } from '../integrations/apiFootball.js';
import { invalidateCache } from '../middleware/cache.js';
import { logger } from '../config/logger.js';
import { prisma } from '../config/database.js';
import { getSocketIO } from '../config/socket.js';
import { type ApiFootballFixture, type ApiFootballFixtureEvent } from '../types/index.js';

/**
 * Map API-Football event types to our schema event types.
 */
const EVENT_TYPE_MAP: Record<string, string> = {
  Goal: 'GOAL',
  Card: 'CARD',        // Further refined by detail (Yellow/Red)
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
 * This is the most frequently executed sync job — runs every 60 seconds.
 * It only processes matches that are currently in progress, making it
 * lightweight and fast.
 *
 * API-Football endpoints:
 * - GET /fixtures?live=all
 * - GET /fixtures/events?fixture={id}
 *
 * Schedule: Every 60 seconds
 */
export const syncLiveMatchesService = {
  /**
   * Sync all currently live matches and their events.
   *
   * @returns Summary of sync results
   */
  async syncLive(): Promise<{ updated: number; events: number; errors: number }> {
    logger.info('Starting live match sync from API-Football');

    const response = await apiFootball.get<ApiFootballFixture>('/fixtures', {
      live: 'all',
    });

    const liveFixtures = response.response;

    if (liveFixtures.length === 0) {
      logger.debug('No live fixtures found');
      return { updated: 0, events: 0, errors: 0 };
    }

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
          } catch (err) {
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
                } catch (err) {
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
          logger.error(
            { err, fixtureId: item.fixture.id },
            'Failed to fetch events for live fixture',
          );
          errors++;
        }
      } catch (err) {
        logger.error(
          { err, fixtureId: item.fixture.id },
          'Failed to sync live fixture',
        );
        errors++;
      }
    }

    // Invalidate match and live match cache after sync
    await invalidateCache('matches:*');

    logger.info(
      { liveFixtures: liveFixtures.length, updated, events, errors },
      'Live match sync completed',
    );

    return { updated, events, errors };
  },
};
