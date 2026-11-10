import path from 'node:path';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join(import.meta.dirname, 'prisma/schema.prisma'),
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
