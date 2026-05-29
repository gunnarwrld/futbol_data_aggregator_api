import path from 'node:path';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 configuration.
 *
 * Database connection URL is sourced from the DATABASE_URL environment variable.
 * This replaces the `url` field in the datasource block of the schema file.
 *
 * @see https://pris.ly/d/config-datasource
 */
export default defineConfig({
  earlyAccess: true,
  schema: path.join(import.meta.dirname, 'schema.prisma'),
  migrate: {
    async resolve({ datasourceUrl }) {
      return { url: datasourceUrl };
    },
  },
});
