import express from 'express';
import { describe, expect, it } from 'vitest';
import { LISTEN_HOST, listenAndThen } from '../../src/startup/listen.js';

async function close(server: ReturnType<typeof listenAndThen>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

describe('listenAndThen', () => {
  it('accepts HTTP on all IPv4 interfaces before post-listen work finishes', async () => {
    const app = express();
    app.get('/health', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    let release = (): void => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const server = listenAndThen(app, 0, () => {
      void gate.then(() => undefined);
    });

    await new Promise<void>((resolve) => {
      server.once('listening', () => {
        resolve();
      });
    });

    const address = server.address();
    expect(address).toMatchObject({ address: LISTEN_HOST });
    const port = typeof address === 'object' && address ? address.port : 0;

    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    await response.json();

    release();
    await close(server);
  });

  it('keeps listening when post-listen startup throws', async () => {
    const app = express();
    app.get('/health', (_req, res) => {
      res.status(200).end('ok');
    });

    const server = listenAndThen(app, 0, () => {
      throw new Error('redis down');
    });

    await new Promise<void>((resolve) => {
      server.once('listening', () => {
        resolve();
      });
    });

    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    await response.text();
    await close(server);
  });
});
