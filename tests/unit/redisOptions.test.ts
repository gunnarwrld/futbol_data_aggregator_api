import Redis from 'ioredis';
import { describe, expect, it } from 'vitest';
import { cacheRedisOptions } from '../../src/config/redisOptions.js';

describe('cacheRedisOptions', () => {
  it('backs off without giving up', () => {
    const retry = cacheRedisOptions().retryStrategy;
    expect(retry).toBeTypeOf('function');
    if (!retry) {
      return;
    }
    expect(retry(1)).toBe(200);
    expect(retry(2)).toBe(400);
    expect(retry(10)).toBe(2_000);
    expect(retry(100)).toBe(5_000);
  });

  it('rejects a command quickly when Redis is not accepting connections', async () => {
    const client = new Redis('redis://127.0.0.1:1/0', {
      ...cacheRedisOptions(),
      retryStrategy: () => null,
    });
    client.on('error', () => undefined);

    const started = Date.now();
    await expect(client.ping()).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2_000);
    client.disconnect();
  });
});
