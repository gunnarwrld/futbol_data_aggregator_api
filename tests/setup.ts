/**
 * Vitest global test setup.
 *
 * This file runs before all test suites to configure:
 * - Environment variables for testing
 * - Global test utilities
 * - Database cleanup hooks (when integration tests are added)
 */

// Set test environment variables
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '0'; // Random port for test server
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/futbol_data_test';
process.env['REDIS_URL'] = 'redis://localhost:6379/1'; // Use Redis DB 1 for tests
process.env['API_FOOTBALL_KEY'] = 'test_api_key';
process.env['API_FOOTBALL_BASE_URL'] = 'https://v3.football.api-sports.io';
process.env['LOG_LEVEL'] = 'silent'; // Suppress logs during tests
