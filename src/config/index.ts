import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Environment variable schema — validated at startup to fail fast
 * on misconfiguration rather than at runtime.
 */
const envSchema = z.object({
  /* ── Server ────────────────────────────────────────────── */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  /* ── Database (PostgreSQL via Prisma) ──────────────────── */
  DATABASE_URL: z.string().url(),

  /* ── Redis ─────────────────────────────────────────────── */
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  /* ── API-Football ──────────────────────────────────────── */
  API_FOOTBALL_KEY: z.string().min(1),
  API_FOOTBALL_BASE_URL: z
    .string()
    .url()
    .default('https://v3.football.api-sports.io'),

  /* ── Rate Limiting ─────────────────────────────────────── */
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(100),

  /* ── Logging ───────────────────────────────────────────── */
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
});

/**
 * Validated and typed configuration object.
 * Throws a descriptive ZodError at startup if any variable is missing or invalid.
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error(
    '❌ Invalid environment variables:\n',
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const config = Object.freeze(parsed.data);

export type Config = z.infer<typeof envSchema>;
