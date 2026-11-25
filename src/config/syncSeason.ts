import { z } from 'zod';

/**
 * API-Football season year used by team and match sync.
 *
 * The Free plan only serves seasons 2022–2024, so the default is 2024
 * rather than the current (often inaccessible) season.
 */
export const DEFAULT_SYNC_SEASON = 2024;

/**
 * Parse `SYNC_SEASON`.
 *
 * The value must be a 4-digit year between 2000 and 2100 inclusive.
 */
export function parseSyncSeason(raw: string): number {
  const token = raw.trim();

  if (!/^[1-9]\d{3}$/.test(token)) {
    throw new Error(`SYNC_SEASON must be a 4-digit year (received "${raw}")`);
  }

  const year = Number(token);
  if (year < 2000 || year > 2100) {
    throw new Error(`SYNC_SEASON is out of range: ${token}`);
  }

  return year;
}

/**
 * Env schema for `SYNC_SEASON`.
 * Missing values fall back to {@link DEFAULT_SYNC_SEASON}.
 */
export const syncSeasonSchema = z
  .string()
  .default(String(DEFAULT_SYNC_SEASON))
  .transform((value, ctx) => {
    try {
      return parseSyncSeason(value);
    } catch (err) {
      ctx.addIssue(err instanceof Error ? err.message : 'Invalid SYNC_SEASON');
      return z.NEVER;
    }
  });
