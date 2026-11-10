import { defineConfig } from 'vitest/config';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://futbol:futbol@localhost:5432/futbol_data_test';
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/1';

/**
 * Unit tests mock Postgres, Redis, and API-Football.
 * Integration tests use the URLs above (Compose locally, service containers in CI).
 */
export default defineConfig({
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: databaseUrl,
      REDIS_URL: redisUrl,
      API_FOOTBALL_KEY: process.env.API_FOOTBALL_KEY ?? 'test_api_key',
      API_FOOTBALL_BASE_URL:
        process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io',
      LOG_LEVEL: 'error',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/server.ts',
        'src/workers/**',
        'src/config/index.ts',
        'src/config/logger.ts',
        'src/config/database.ts',
        'src/config/redis.ts',
        'src/config/queue.ts',
        'src/config/socket.ts',
        'src/types/**',
      ],
      thresholds: {
        statements: 90,
        branches: 80,
        functions: 85,
        lines: 90,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          setupFiles: ['./tests/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          setupFiles: ['./tests/setup.ts', './tests/integration/setup.ts'],
          globalSetup: ['./tests/integration/globalSetup.ts'],
          globalSetupTimeout: 120_000,
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
