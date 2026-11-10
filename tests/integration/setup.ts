import { afterAll, beforeEach } from 'vitest';
import { disconnectDatabase, prisma } from '../../src/config/database.js';
import { disconnectRedis, redis } from '../../src/config/redis.js';

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "MatchEvent", "Match", "Player", "Team", "League", "ApiKey" RESTART IDENTITY CASCADE`,
  );
  await redis.flushdb();
});

afterAll(async () => {
  await disconnectDatabase();
  await disconnectRedis();
});
