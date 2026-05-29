import pino from 'pino';
import { config } from './index.js';

/**
 * Application logger — structured JSON in production, pretty-printed in development.
 *
 * Usage:
 * ```ts
 * import { logger } from '@/config/logger.js';
 * logger.info({ userId: 123 }, 'User authenticated');
 * ```
 */
export const logger = pino({
  level: config.LOG_LEVEL,
  transport:
    config.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    env: config.NODE_ENV,
  },
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
