import { createWorker } from '../config/queue.js';
import { syncLeaguesService } from '../services/syncLeagues.service.js';
import { syncTeamsService } from '../services/syncTeams.service.js';
import { syncMatchesService } from '../services/syncMatches.service.js';
import { syncLiveMatchesService } from '../services/syncLiveMatches.service.js';
import {
  syncLeaguesQueue,
  syncTeamsQueue,
  syncMatchesQueue,
  syncLiveMatchesQueue,
  closeAllQueues,
} from '../config/queue.js';
import { logger } from '../config/logger.js';
import { type Worker } from 'bullmq';

/**
 * All active workers — tracked for graceful shutdown.
 */
const workers: Worker[] = [];

/**
 * Initialize all BullMQ workers and schedule repeatable jobs.
 *
 * This function is called once during server startup.
 * Each worker is registered with its processor function and
 * a repeatable job is added to the queue with the appropriate interval.
 *
 * Repeatable Job Schedule:
 * ────────────────────────
 * │ Queue              │ Interval     │ Justification                         │
 * │ sync-leagues       │ 24 hours     │ Leagues rarely change mid-season      │
 * │ sync-teams         │ 24 hours     │ Rosters are mostly static             │
 * │ sync-matches       │ 6 hours      │ Catches newly scheduled fixtures      │
 * │ sync-live-matches  │ 60 seconds   │ Near real-time score updates          │
 *
 * BullMQ Distributed Lock Guarantee:
 * ──────────────────────────────────
 * Even if 10 servers are running this code, BullMQ uses Redis
 * to ensure each repeatable job runs EXACTLY ONCE per interval.
 * No duplicate API-Football calls. No database collisions.
 */
export async function initializeWorkers(): Promise<void> {
  logger.info('Initializing BullMQ workers...');

  /* ── League Sync Worker ──────────────────────────────── */
  const leagueWorker = createWorker('sync-leagues', async () => {
    await syncLeaguesService.syncAll();
  });
  workers.push(leagueWorker);

  await syncLeaguesQueue.upsertJobScheduler(
    'sync-leagues-repeat',
    { pattern: '0 3 * * *' }, // Every day at 3:00 AM
    {
      name: 'sync-leagues',
      opts: { attempts: 3 },
    },
  );

  /* ── Team Sync Worker ────────────────────────────────── */
  const teamWorker = createWorker('sync-teams', async () => {
    await syncTeamsService.syncAll();
  });
  workers.push(teamWorker);

  await syncTeamsQueue.upsertJobScheduler(
    'sync-teams-repeat',
    { pattern: '0 4 * * *' }, // Every day at 4:00 AM (after leagues)
    {
      name: 'sync-teams',
      opts: { attempts: 3 },
    },
  );

  /* ── Match Sync Worker ───────────────────────────────── */
  const matchWorker = createWorker('sync-matches', async () => {
    await syncMatchesService.syncAll();
  });
  workers.push(matchWorker);

  await syncMatchesQueue.upsertJobScheduler(
    'sync-matches-repeat',
    { every: 6 * 60 * 60 * 1000 }, // Every 6 hours
    {
      name: 'sync-matches',
      opts: { attempts: 3 },
    },
  );

  /* ── Live Match Sync Worker ──────────────────────────── */
  const liveMatchWorker = createWorker('sync-live-matches', async () => {
    await syncLiveMatchesService.syncLive();
  });
  workers.push(liveMatchWorker);

  await syncLiveMatchesQueue.upsertJobScheduler(
    'sync-live-matches-repeat',
    { every: 60_000 }, // Every 60 seconds
    {
      name: 'sync-live-matches',
      opts: { attempts: 1 }, // Don't retry live — next interval will handle it
    },
  );

  logger.info(
    { workerCount: workers.length },
    'All BullMQ workers initialized and repeatable jobs scheduled',
  );
}

/**
 * Gracefully shut down all workers and queues.
 *
 * Called during server shutdown to ensure:
 * - Active jobs are allowed to finish
 * - No orphaned Redis connections remain
 * - No new jobs are picked up during shutdown
 */
export async function shutdownWorkers(): Promise<void> {
  logger.info('Shutting down BullMQ workers...');

  // Close all workers (waits for active jobs to finish)
  await Promise.all(workers.map((w) => w.close()));
  logger.info('All BullMQ workers closed');

  // Close all queue connections
  await closeAllQueues();
}
