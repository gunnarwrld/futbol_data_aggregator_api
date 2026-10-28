import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/config/database.js';
import { apiKeyService } from '../../src/services/apiKey.service.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    apiKey: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  },
  disconnectDatabase: vi.fn(),
}));

const delegate = prisma.apiKey;

function storedKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    name: 'Mobile',
    hashedKey: 'hash',
    prefix: 'fda_abcdef12',
    tier: 'standard',
    rateLimit: 1000,
    isActive: true,
    expiresAt: null,
    lastUsedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('apiKeyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('stores only the SHA-256 hash and a 12-character prefix', async () => {
    vi.mocked(delegate.create).mockImplementation(async (args) => {
      const data = (args as { data: Record<string, unknown> }).data;
      return storedKey(data) as Awaited<ReturnType<typeof delegate.create>>;
    });

    const result = await apiKeyService.create({ name: 'Mobile' });

    expect(result.rawKey).toMatch(/^fda_[0-9a-f]{64}$/);
    expect(result.apiKey.prefix).toBe(result.rawKey.slice(0, 12));
    expect(result.apiKey.rateLimit).toBe(1000);
    expect(result.apiKey.tier).toBe('standard');
    const saved = vi.mocked(delegate.create).mock.calls[0]?.[0] as {
      data: { hashedKey: string; prefix: string };
    };
    expect(saved.data.hashedKey).toBe(createHash('sha256').update(result.rawKey).digest('hex'));
    expect(saved.data.hashedKey).not.toBe(result.rawKey);
    expect(saved.data.prefix).toHaveLength(12);
  });

  it('uses 5000/hour for premium and honors an explicit limit', async () => {
    vi.mocked(delegate.create).mockImplementation(async (args) => {
      return storedKey((args as { data: Record<string, unknown> }).data) as Awaited<
        ReturnType<typeof delegate.create>
      >;
    });

    const premium = await apiKeyService.create({ name: 'Pro', tier: 'premium' });
    const custom = await apiKeyService.create({ name: 'Tight', tier: 'premium', rateLimit: 25 });

    expect(premium.apiKey.rateLimit).toBe(5000);
    expect(custom.apiKey.rateLimit).toBe(25);
  });

  it('rejects missing, inactive, and expired keys', async () => {
    vi.mocked(delegate.findUnique).mockResolvedValueOnce(null);
    await expect(apiKeyService.validate('fda_missing')).resolves.toBeNull();

    vi.mocked(delegate.findUnique).mockResolvedValueOnce(
      storedKey({ isActive: false }) as Awaited<ReturnType<typeof delegate.findUnique>>,
    );
    await expect(apiKeyService.validate('fda_revoked')).resolves.toBeNull();

    vi.mocked(delegate.findUnique).mockResolvedValueOnce(
      storedKey({ expiresAt: new Date(Date.now() - 60_000) }) as Awaited<
        ReturnType<typeof delegate.findUnique>
      >,
    );
    await expect(apiKeyService.validate('fda_expired')).resolves.toBeNull();
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('returns an active key and records lastUsedAt without failing the request', async () => {
    const record = storedKey({ expiresAt: new Date(Date.now() + 60_000) });
    vi.mocked(delegate.findUnique).mockResolvedValue(
      record as Awaited<ReturnType<typeof delegate.findUnique>>,
    );
    vi.mocked(delegate.update).mockRejectedValue(new Error('write failed'));

    await expect(apiKeyService.validate('fda_ok')).resolves.toEqual(record);
    await vi.waitFor(() => {
      expect(delegate.update).toHaveBeenCalledWith({
        where: { id: 'key-1' },
        data: { lastUsedAt: expect.any(Date) },
      });
    });
  });

  it('revokes a key and lists keys without the hash', async () => {
    vi.mocked(delegate.update).mockResolvedValue(
      storedKey({ isActive: false }) as Awaited<ReturnType<typeof delegate.update>>,
    );
    vi.mocked(delegate.findMany).mockResolvedValue([]);

    const revoked = await apiKeyService.revoke('key-1');
    await apiKeyService.list();

    expect(revoked.isActive).toBe(false);
    expect(delegate.update).toHaveBeenCalledWith({
      where: { id: 'key-1' },
      data: { isActive: false },
    });
    expect(delegate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ hashedKey: true }),
      }),
    );
  });
});
