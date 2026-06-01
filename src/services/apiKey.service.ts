import { randomBytes, createHash } from 'node:crypto';
import { prisma } from '../config/database.js';
import { logger } from '../config/logger.js';

/**
 * API Key Service — Handles generation, validation, and lifecycle
 * management of downstream consumer API keys.
 *
 * Security design:
 * ─────────────────
 * - Raw keys are generated with 32 bytes of cryptographically secure randomness
 * - Only SHA-256 hashed keys are stored in the database
 * - The raw key is returned ONCE during creation — it cannot be recovered
 * - A short prefix (first 8 chars) is stored for human identification
 *
 * Rate limit tiers:
 * ─────────────────
 * - standard: 1,000 requests/hour (default)
 * - premium:  5,000 requests/hour
 */

/** Prefix all keys with this identifier for easy recognition */
const KEY_PREFIX = 'fda_';

/**
 * Hash a raw API key using SHA-256.
 */
function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Generate a cryptographically secure raw API key.
 * Format: fda_<64 hex chars> = 68 chars total
 */
function generateRawKey(): string {
  return `${KEY_PREFIX}${randomBytes(32).toString('hex')}`;
}

export const apiKeyService = {
  /**
   * Create a new API key.
   *
   * @returns The raw key (shown once) and the database record
   */
  async create(data: {
    name: string;
    tier?: 'standard' | 'premium';
    rateLimit?: number;
    expiresAt?: Date;
  }) {
    const rawKey = generateRawKey();
    const hashed = hashKey(rawKey);
    const prefix = rawKey.substring(0, 12); // "fda_" + first 8 hex chars

    const tierRateLimits: Record<string, number> = {
      standard: 1_000,
      premium: 5_000,
    };

    const tier = data.tier ?? 'standard';
    const rateLimit = data.rateLimit ?? tierRateLimits[tier] ?? 1_000;

    const apiKey = await prisma.apiKey.create({
      data: {
        name: data.name,
        hashedKey: hashed,
        prefix,
        tier,
        rateLimit,
        expiresAt: data.expiresAt ?? null,
      },
    });

    logger.info(
      { apiKeyId: apiKey.id, name: apiKey.name, tier, prefix },
      'API key created',
    );

    return {
      /** The raw key — shown ONCE, never stored or recoverable */
      rawKey,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        tier: apiKey.tier,
        rateLimit: apiKey.rateLimit,
        isActive: apiKey.isActive,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
    };
  },

  /**
   * Validate a raw API key.
   *
   * Checks:
   * 1. Key exists in the database
   * 2. Key is not revoked (isActive)
   * 3. Key is not expired
   *
   * Side effect: Updates `lastUsedAt` timestamp asynchronously
   *
   * @returns The API key record if valid, null otherwise
   */
  async validate(rawKey: string) {
    const hashed = hashKey(rawKey);

    const apiKey = await prisma.apiKey.findUnique({
      where: { hashedKey: hashed },
    });

    if (!apiKey) return null;
    if (!apiKey.isActive) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    // Update lastUsedAt asynchronously — don't block the request
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err: unknown) => {
        logger.error({ err, apiKeyId: apiKey.id }, 'Failed to update lastUsedAt');
      });

    return apiKey;
  },

  /**
   * Revoke an API key by ID.
   */
  async revoke(id: string) {
    const apiKey = await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info({ apiKeyId: id }, 'API key revoked');
    return apiKey;
  },

  /**
   * List all API keys (excludes hashed key for security).
   */
  async list() {
    return prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        prefix: true,
        tier: true,
        rateLimit: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },
};
