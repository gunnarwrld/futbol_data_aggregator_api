import { disconnectDatabase } from '../src/config/database.js';
import { apiKeyService } from '../src/services/apiKey.service.js';

const name = process.argv[2]?.trim();

if (!name) {
  console.error('Usage: npm run admin:create-key -- "<name>"');
  process.exit(1);
}

let exitCode = 0;

try {
  const created = await apiKeyService.create({ name });
  console.log(created.rawKey);
} catch (err: unknown) {
  console.error(err instanceof Error ? err.message : 'Failed to create API key');
  exitCode = 1;
} finally {
  try {
    await disconnectDatabase();
  } catch (err: unknown) {
    console.error(err instanceof Error ? err.message : 'Failed to close the database');
    exitCode = 1;
  }
  // The dev logger starts a pino-pretty worker. Closing Postgres does not
  // stop that worker, so the process would stay up after the key is printed.
  process.exit(exitCode);
}
