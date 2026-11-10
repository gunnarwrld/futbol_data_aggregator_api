/**
 * Connection and startup failures from Postgres, Prisma, or the `pg` driver.
 *
 * Railway's idle Postgres sleeps. The first query often fails with a timeout
 * or "the database system is starting up" while the server wakes, and the
 * next attempt succeeds.
 */

const TRANSIENT_CODES = new Set([
  // Prisma: can't reach server, server timeout, operation timeout,
  // server closed the connection, pool checkout timeout.
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  // Node / driver network failures while the server is waking.
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EAI_AGAIN',
  'EPIPE',
  'ECONNABORTED',
  // Postgres SQLSTATE: shutdown, starting up, connection exceptions, too many clients.
  '57P01',
  '57P02',
  '57P03',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08007',
  '08P01',
  '53300',
]);

const TRANSIENT_MESSAGE =
  /ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|ECONNABORTED|timed?\s*out|timeout|connection terminated|database system is (starting up|shutting down)|can't reach database server|server has closed the connection|closed the connection unexpectedly|connection refused/i;

const MAX_CAUSE_DEPTH = 5;

function readString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== 'object' || !(key in value)) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : undefined;
}

function hasTransientCode(value: unknown): boolean {
  const code = readString(value, 'code') ?? readString(value, 'originalCode');
  return code !== undefined && TRANSIENT_CODES.has(code);
}

/**
 * Whether `err` is a transient database connectivity failure.
 * Walks `cause`, Prisma `meta.driverAdapterError`, and driver `originalCode`.
 */
export function isTransientDatabaseError(err: unknown, depth = 0): boolean {
  if (depth > MAX_CAUSE_DEPTH || err == null || typeof err !== 'object') return false;
  if (hasTransientCode(err)) return true;

  const message = readString(err, 'message');
  if (message !== undefined && TRANSIENT_MESSAGE.test(message)) return true;

  const cause = (err as { cause?: unknown }).cause;
  if (isTransientDatabaseError(cause, depth + 1)) return true;

  const meta = (err as { meta?: unknown }).meta;
  if (meta && typeof meta === 'object') {
    const driverAdapterError = (meta as { driverAdapterError?: unknown }).driverAdapterError;
    if (isTransientDatabaseError(driverAdapterError, depth + 1)) return true;
  }

  return false;
}
