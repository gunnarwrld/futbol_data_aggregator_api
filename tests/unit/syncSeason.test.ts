import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SYNC_SEASON,
  parseSyncSeason,
  syncSeasonSchema,
} from '../../src/config/syncSeason.js';
import { config } from '../../src/config/index.js';

describe('SYNC_SEASON', () => {
  it('defaults to 2024 when unset', () => {
    expect(DEFAULT_SYNC_SEASON).toBe(2024);
    expect(syncSeasonSchema.parse(undefined)).toBe(2024);
    expect(config.SYNC_SEASON).toBe(2024);
  });

  it('parses a valid year and trims whitespace', () => {
    expect(parseSyncSeason('2022')).toBe(2022);
    expect(parseSyncSeason('  2024  ')).toBe(2024);
    expect(syncSeasonSchema.parse('2023')).toBe(2023);
  });

  it('rejects values that are not a 4-digit year in range', () => {
    expect(syncSeasonSchema.safeParse('').success).toBe(false);
    expect(syncSeasonSchema.safeParse('   ').success).toBe(false);
    expect(syncSeasonSchema.safeParse('24').success).toBe(false);
    expect(syncSeasonSchema.safeParse('2024/2025').success).toBe(false);
    expect(syncSeasonSchema.safeParse('2024.5').success).toBe(false);
    expect(syncSeasonSchema.safeParse('abc').success).toBe(false);
    expect(syncSeasonSchema.safeParse('1999').success).toBe(false);
    expect(syncSeasonSchema.safeParse('2101').success).toBe(false);
  });
});
