/**
 * In-process gate for the live fixtures poll.
 *
 * The BullMQ scheduler still ticks every 60 seconds so a match that is
 * actually in progress can be refreshed quickly. This gate skips the
 * API-Football call — and, once a backoff is set, the database check —
 * when there is nothing to watch or the upstream API is refusing requests.
 */

/** How long a watched kickoff stays eligible after its scheduled start. */
export const LIVE_KICKOFF_LOOKBACK_MS = 3 * 60 * 60 * 1000;

/** How early before kickoff a scheduled match becomes eligible. */
export const LIVE_KICKOFF_LOOKAHEAD_MS = 15 * 60 * 1000;

/**
 * After an empty live response, or when no stored match is in the window.
 * Keeps an idle database asleep between checks.
 */
export const LIVE_IDLE_BACKOFF_MS = 10 * 60 * 1000;

/**
 * Watched league IDs are configured, but none of those rows exist yet
 * (empty database, or league sync has not run).
 */
export const LIVE_EMPTY_CATALOG_BACKOFF_MS = 30 * 60 * 1000;

/** HTTP 403 / 429 from API-Football. Do not spend another request every minute. */
export const LIVE_UPSTREAM_BACKOFF_MS = 60 * 60 * 1000;

let nextAttemptAt = 0;

export const livePollGate = {
  shouldSkip(now = Date.now()): boolean {
    return now < nextAttemptAt;
  },

  backoff(ms: number, now = Date.now()): void {
    nextAttemptAt = now + ms;
  },

  clear(): void {
    nextAttemptAt = 0;
  },
};
