import { disconnectDatabase } from '../src/config/database.js';
import { apiKeyService } from '../src/services/apiKey.service.js';

const name = process.argv[2]?.trim();

if (!name) {
  console.error('Usage: npm run admin:create-key -- "<name>"');
  process.exit(1);
}

try {
  const created = await apiKeyService.create({ name });
  console.log(created.rawKey);
} finally {
  await disconnectDatabase();
}
