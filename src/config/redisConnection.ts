import type { RedisOptions } from 'ioredis';

/**
 * Fields ioredis uses when it is constructed with a `redis://` or `rediss://` URL.
 * Empty userinfo is left unset so an unauthenticated local Redis does not get AUTH.
 */
export interface ParsedRedisCredentials {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  tls: boolean;
}

/**
 * Percent-decode userinfo the way ioredis does.
 * `URL` has already decoded once; ioredis decodes again.
 */
function decodeUserinfo(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Parse host, port, username, password, database index, and TLS from a Redis URL.
 *
 * This mirrors the cache client, which is constructed with the raw URL
 * (`new Redis(REDIS_URL)`). BullMQ must receive these same fields or Redis
 * replies `NOAUTH` when the URL contains credentials.
 */
export function parseRedisUrl(redisUrl: string): ParsedRedisCredentials {
  const parsed = new URL(redisUrl);
  const tls = parsed.protocol === 'rediss:';
  const port = parsed.port ? Number(parsed.port) : 6379;
  const host = parsed.hostname.replace(/^\[|\]$/g, '');

  const hasUserinfo = parsed.username !== '' || parsed.password !== '';
  const username = hasUserinfo ? decodeUserinfo(parsed.username) : undefined;
  const password = hasUserinfo ? decodeUserinfo(parsed.password) : undefined;

  let db = 0;
  if (parsed.pathname.length > 1) {
    const index = Number(parsed.pathname.slice(1));
    if (Number.isInteger(index) && index >= 0) {
      db = index;
    }
  }

  const result: ParsedRedisCredentials = { host, port, db, tls };
  if (username !== undefined) {
    result.username = username;
  }
  if (password !== undefined) {
    result.password = password;
  }
  return result;
}

/**
 * Connection options for every BullMQ Queue and Worker.
 *
 * A plain options object (not a shared ioredis instance) lets BullMQ open one
 * connection per Queue and per Worker. Workers use blocking commands, so they
 * cannot share the cache client's connection. `maxRetriesPerRequest: null` is
 * required for those blocking commands.
 */
export function bullmqConnectionOptions(redisUrl: string): RedisOptions {
  const parsed = parseRedisUrl(redisUrl);
  const options: RedisOptions = {
    host: parsed.host,
    port: parsed.port,
    db: parsed.db,
    maxRetriesPerRequest: null,
  };

  if (parsed.username !== undefined) {
    options.username = parsed.username;
  }
  if (parsed.password !== undefined) {
    options.password = parsed.password;
  }
  if (parsed.tls) {
    options.tls = {};
  }

  return options;
}
