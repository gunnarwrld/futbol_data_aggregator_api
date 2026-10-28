import { execSync } from 'node:child_process';
import pg from 'pg';

/**
 * Creates the test database when needed and applies committed migrations.
 * Runs in the Vitest main process, so it repeats the URL default instead of
 * relying on worker-only test.env.
 */
export default async function setup(): Promise<void> {
  const databaseUrl =
    process.env.DATABASE_URL ?? 'postgresql://futbol:futbol@localhost:5432/futbol_data_test';
  process.env.DATABASE_URL = databaseUrl;
  process.env.API_FOOTBALL_KEY ??= 'test_api_key';

  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(`Refusing to create a database named "${database}"`);
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${database}"`);
    }
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: process.env,
  });
}
