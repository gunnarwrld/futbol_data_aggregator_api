import { describe, it, expect } from 'vitest';
import Redis from 'ioredis';
import { bullmqConnectionOptions, parseRedisUrl } from '../../src/config/redisConnection.js';

describe('parseRedisUrl', () => {
  it('keeps username, password, host, port, and database from an authenticated URL', () => {
    const parsed = parseRedisUrl('redis://default:p%40ss%3Aword@redis.railway.internal:6380/2');

    expect(parsed).toEqual({
      host: 'redis.railway.internal',
      port: 6380,
      username: 'default',
      password: 'p@ss:word',
      db: 2,
      tls: false,
    });
  });

  it('keeps a password when the URL has an empty username', () => {
    const parsed = parseRedisUrl('redis://:s3cret@localhost:6379');

    expect(parsed.username).toBe('');
    expect(parsed.password).toBe('s3cret');
    expect(parsed.host).toBe('localhost');
    expect(parsed.port).toBe(6379);
    expect(parsed.tls).toBe(false);
  });

  it('omits credentials for an unauthenticated local URL', () => {
    const parsed = parseRedisUrl('redis://localhost:6379');

    expect(parsed.username).toBeUndefined();
    expect(parsed.password).toBeUndefined();
    expect(parsed.host).toBe('localhost');
    expect(parsed.port).toBe(6379);
    expect(parsed.db).toBe(0);
    expect(parsed.tls).toBe(false);
  });

  it('defaults the port to 6379 and keeps the database index', () => {
    const parsed = parseRedisUrl('redis://localhost/1');

    expect(parsed.port).toBe(6379);
    expect(parsed.db).toBe(1);
    expect(parsed.password).toBeUndefined();
  });

  it('marks rediss URLs as TLS', () => {
    const parsed = parseRedisUrl('rediss://default:secret@example.com:6380');

    expect(parsed.tls).toBe(true);
    expect(parsed.username).toBe('default');
    expect(parsed.password).toBe('secret');
    expect(parsed.host).toBe('example.com');
    expect(parsed.port).toBe(6380);
  });
});

describe('bullmqConnectionOptions', () => {
  it('copies parsed credentials and requires null retries for BullMQ', () => {
    const options = bullmqConnectionOptions('redis://default:s3cret@redis.railway.internal:6379/1');

    expect(options).toMatchObject({
      host: 'redis.railway.internal',
      port: 6379,
      username: 'default',
      password: 's3cret',
      db: 1,
      maxRetriesPerRequest: null,
    });
    expect(options.tls).toBeUndefined();
  });

  it('does not set a password for local Redis without credentials', () => {
    const options = bullmqConnectionOptions('redis://localhost:6379');

    expect(options.username).toBeUndefined();
    expect(options.password).toBeUndefined();
    expect(options.maxRetriesPerRequest).toBeNull();
    expect(options.host).toBe('localhost');
    expect(options.port).toBe(6379);
  });

  it('enables TLS for rediss URLs', () => {
    const options = bullmqConnectionOptions('rediss://default:secret@example.com:6380');

    expect(options.tls).toEqual({});
    expect(options.password).toBe('secret');
  });

  it('matches the username and password ioredis reads from the same URL', () => {
    const url = 'redis://default:p%40ss%3Aword@redis.railway.internal:6380/2';
    const options = bullmqConnectionOptions(url);
    const fromUrl = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });
    const fromOptions = new Redis({ ...options, lazyConnect: true });

    try {
      expect(fromOptions.options.username).toBe(fromUrl.options.username);
      expect(fromOptions.options.password).toBe(fromUrl.options.password);
      expect(fromOptions.options.host).toBe(fromUrl.options.host);
      expect(fromOptions.options.port).toBe(fromUrl.options.port);
      expect(fromOptions.options.db).toBe(fromUrl.options.db);
      expect(Boolean(fromOptions.options.tls)).toBe(Boolean(fromUrl.options.tls));
      expect(fromUrl.options.password).toBe('p@ss:word');
    } finally {
      fromUrl.disconnect();
      fromOptions.disconnect();
    }
  });
});
