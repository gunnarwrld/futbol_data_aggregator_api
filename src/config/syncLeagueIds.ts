import { z } from 'zod';

/**
 * API-Football league IDs published in the official beginner guide:
 * Premier League `39`, La Liga `140`, UEFA Champions League `2`.
 *
 * @see https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide
 */
export const DEFAULT_SYNC_LEAGUE_IDS = '39,140,2';

/**
 * Parse `SYNC_LEAGUE_IDS`.
 *
 * An empty string syncs nothing. Otherwise the value must be a comma-separated
 * list of positive integers. Duplicates are removed and order is preserved.
 */
export function parseSyncLeagueIds(raw: string): number[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return [];

  const seen = new Set<number>();
  const ids: number[] = [];

  for (const part of trimmed.split(',')) {
    const token = part.trim();
    if (token.length === 0) continue;

    if (!/^[1-9]\d*$/.test(token)) {
      throw new Error(
        `SYNC_LEAGUE_IDS must be a comma-separated list of positive integers (received "${token}")`,
      );
    }

    const id = Number(token);
    if (!Number.isSafeInteger(id)) {
      throw new Error(`SYNC_LEAGUE_IDS entry is out of range: ${token}`);
    }

    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }

  return ids;
}

/**
 * Env schema for `SYNC_LEAGUE_IDS`.
 * Missing values fall back to {@link DEFAULT_SYNC_LEAGUE_IDS}.
 */
export const syncLeagueIdsSchema = z
  .string()
  .default(DEFAULT_SYNC_LEAGUE_IDS)
  .transform((value, ctx) => {
    try {
      return parseSyncLeagueIds(value);
    } catch (err) {
      ctx.addIssue(err instanceof Error ? err.message : 'Invalid SYNC_LEAGUE_IDS');
      return z.NEVER;
    }
  });
