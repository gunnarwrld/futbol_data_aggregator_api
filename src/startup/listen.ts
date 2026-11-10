import type { Server } from 'node:http';
import type { Express } from 'express';
import { logger } from '../config/logger.js';

/** Railway's proxy dials the instance over IPv4. Bind every IPv4 interface. */
export const LISTEN_HOST = '0.0.0.0';

/**
 * Bind the HTTP server, then run post-listen work.
 *
 * The callback is not awaited. A sleeping Redis or a BullMQ handshake that
 * never resolves must not delay accept() — the listen callback runs only
 * after the port is open, and a throw there is logged instead of closing it.
 */
export function listenAndThen(
  app: Express,
  port: number,
  afterListen: (server: Server) => void,
): Server {
  return app.listen(port, LISTEN_HOST, function onListening(this: Server) {
    try {
      afterListen(this);
    } catch (err: unknown) {
      logger.error({ err }, 'Post-listen startup failed');
    }
  });
}
