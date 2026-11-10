/**
 * Defaults for tests that import config. Vitest also injects `test.env`.
 * Existing process env (CI service URLs) wins.
 */
process.env.NODE_ENV ??= 'test';
process.env.PORT ??= '3000';
process.env.DATABASE_URL ??= 'postgresql://futbol:futbol@localhost:5432/futbol_data_test';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379/1';
process.env.API_FOOTBALL_KEY ??= 'test_api_key';
process.env.API_FOOTBALL_BASE_URL ??= 'https://v3.football.api-sports.io';
process.env.LOG_LEVEL ??= 'error';
