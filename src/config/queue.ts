import { Queue, Worker, type ConnectionOptions, type WorkerOptions, type QueueOptions } from 'bullmq';
import { config } from './index.js';
import { logger } from './logger.js';

/**
 * BullMQ connection configuration.
 *
 * Shares the same Redis instance used for caching,
 * but BullMQ manages its own connection pool internally.
 * This prevents blocking the cache client during heavy job processing.
 *
 * Why BullMQ over node-cron?
 * ─────────────────────────
 * If this API scales to N servers, a standard cron package runs on ALL N servers
 * simultaneously. BullMQ uses Redis as a distributed lock — guaranteeing that
 * even with 10 servers running, the API-Football fetch happens exactly ONCE
 * per interval. This protects rate limits and prevents database collisions.
 */
const connection: ConnectionOptions = {
  host: new URL(config.REDIS_URL).hostname,
  port: Number(new URL(config.REDIS_URL).port) || 6379,
  maxRetriesPerRequest: null, // Required by BullMQ — disables ioredis retry limit
};

/**
 * Default job options applied to all queues.
 */
const defaultJobOptions: QueueOptions['defaultJobOptions'] = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000, // 5s → 10s → 20s
  },
  removeOnComplete: {
    age: 3600,   // Keep completed jobs for 1 hour
    count: 100,  // Keep last 100 completed jobs
  },
  removeOnFail: {
    age: 86400,  // Keep failed jobs for 24 hours
    count: 500,  // Keep last 500 failed jobs
  },
};

/* ── Queue Instances ────────────────────────────────────── */

export const syncLeaguesQueue = new Queue('sync-leagues', {
  connection,
  defaultJobOptions,
});

export const syncTeamsQueue = new Queue('sync-teams', {
  connection,
  defaultJobOptions,
});

export const syncMatchesQueue = new Queue('sync-matches', {
  connection,
  defaultJobOptions,
});

export const syncLiveMatchesQueue = new Queue('sync-live-matches', {
  connection,
  defaultJobOptions,
});

/* ── Worker Factory ─────────────────────────────────────── */

/**
 * Creates a BullMQ Worker with standardized error handling and logging.
 *
 * @param queueName - Name of the queue this worker processes
 * @param processor - Async function that processes each job
 * @param opts - Optional worker configuration overrides
 */
export function createWorker(
  queueName: string,
  processor: (job: import('bullmq').Job) => Promise<void>,
  opts?: Partial<WorkerOptions>,
): Worker {
  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: 1, // Process one job at a time to respect rate limits
    ...opts,
  });

  worker.on('completed', (job) => {
    logger.info(
      { queue: queueName, jobId: job.id, jobName: job.name },
      'Job completed successfully',
    );
  });

  worker.on('failed', (job, err) => {
    logger.error(
      { queue: queueName, jobId: job?.id, jobName: job?.name, err },
      'Job failed',
    );
  });

  worker.on('error', (err) => {
    logger.error({ queue: queueName, err }, 'Worker error');
  });

  logger.info({ queue: queueName }, 'Worker initialized');

  return worker;
}

/* ── Queue Cleanup ──────────────────────────────────────── */

/**
 * Gracefully close all queues and workers.
 * Called during server shutdown to ensure no orphaned Redis connections.
 */
const allQueues: Queue[] = [
  syncLeaguesQueue,
  syncTeamsQueue,
  syncMatchesQueue,
  syncLiveMatchesQueue,
];

export async function closeAllQueues(): Promise<void> {
  await Promise.all(allQueues.map((q) => q.close()));
  logger.info('All BullMQ queues closed');
}
