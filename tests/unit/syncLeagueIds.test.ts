import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SYNC_LEAGUE_IDS,
  parseSyncLeagueIds,
  syncLeagueIdsSchema,
} from '../../src/config/syncLeagueIds.js';
import { config } from '../../src/config/index.js';

describe('SYNC_LEAGUE_IDS', () => {
  it('documents the verified default ids', () => {
    expect(DEFAULT_SYNC_LEAGUE_IDS).toBe('39,140,2');
    expect(syncLeagueIdsSchema.parse(undefined)).toEqual([39, 140, 2]);
    expect(config.SYNC_LEAGUE_IDS).toEqual([39, 140, 2]);
  });

  it('parses a spaced list and drops duplicates', () => {
    expect(parseSyncLeagueIds('39, 140, 39, 2')).toEqual([39, 140, 2]);
    expect(syncLeagueIdsSchema.parse('2,2,140')).toEqual([2, 140]);
  });

  it('treats an empty value as sync nothing', () => {
    expect(parseSyncLeagueIds('')).toEqual([]);
    expect(parseSyncLeagueIds('   ')).toEqual([]);
    expect(syncLeagueIdsSchema.parse('')).toEqual([]);
    expect(syncLeagueIdsSchema.parse('39,')).toEqual([39]);
  });

  it('rejects tokens that are not positive integers', () => {
    expect(syncLeagueIdsSchema.safeParse('39,abc').success).toBe(false);
    expect(syncLeagueIdsSchema.safeParse('0').success).toBe(false);
    expect(syncLeagueIdsSchema.safeParse('-2').success).toBe(false);
    expect(syncLeagueIdsSchema.safeParse('39.5').success).toBe(false);
  });
});
