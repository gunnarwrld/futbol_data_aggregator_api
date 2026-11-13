/* eslint-disable no-console -- CLI output includes the one-time raw key and errors. */
import { disconnectDatabase } from '../config/database.js';
import { apiKeyService } from '../services/apiKey.service.js';

const name = process.argv[2]?.trim();

if (!name) {
  console.error('Usage: npm run admin:create-key -- "<name>"');
  process.exit(1);
}

let exitCode = 0;

try {
  const created = await apiKeyService.create({ name, isAdmin: true });
  console.log(created.rawKey);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  exitCode = 1;
} finally {
  try {
    await disconnectDatabase();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    exitCode = 1;
  }
}

// In development the logger runs pino-pretty in a worker thread, which keeps
// the event loop alive after the key is printed. Exit explicitly.
process.exit(exitCode);
