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
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  await disconnectDatabase();
}

// In development the logger runs pino-pretty in a worker thread, which keeps
// the event loop alive after the key is printed. Exit explicitly.
process.exit(exitCode);
