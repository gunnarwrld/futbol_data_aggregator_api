import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import { logger } from './config/logger.js';
import { authenticateApiKey } from './middleware/authenticateApiKey.js';
import { slidingWindowRateLimiter } from './middleware/slidingWindowRateLimiter.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRouter } from './routes/index.js';
import { AppError } from './utils/AppError.js';

/**
 * Express application factory.
 *
 * Creates and configures the Express app with security, parsing,
 * compression, logging, API key auth, rate limiting, API routes, and error handling.
 *
 * Middleware execution order matters:
 * 1. Security headers (helmet)
 * 2. CORS
 * 3. Compression
 * 4. Body parsing
 * 5. Request logging
 * 6. API Key Authentication (extracts x-api-key → req.apiKey)
 * 7. Sliding Window Rate Limiting (Redis-backed, tier-aware)
 * 8. API routes
 * 9. 404 catch-all
 * 10. Global error handler
 */
const app = express();

/* ── 1. Security Headers ─────────────────────────────────── */
app.use(helmet());

/* ── 2. CORS ─────────────────────────────────────────────── */
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Api-Key'],
    maxAge: 86400, // 24 hours
  }),
);

/* ── 3. Compression ──────────────────────────────────────── */
app.use(compression());

/* ── 4. Body Parsing ─────────────────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/* ── 5. Request Logging ──────────────────────────────────── */
app.use(
  pinoHttp.default({
    logger,
    autoLogging: {
      ignore: (req: { url?: string }) => req.url === '/health',
    },
    customLogLevel: (
      _req: unknown,
      res: { statusCode?: number },
      err: unknown,
    ) => {
      if (err ?? (res.statusCode && res.statusCode >= 500)) return 'error';
      if (res.statusCode && res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req: { method?: string; url?: string }) => ({
        method: req.method,
        url: req.url,
      }),
      res: (res: { statusCode?: number }) => ({
        statusCode: res.statusCode,
      }),
    },
  }),
);

/* ── 6. API Key Authentication ───────────────────────────── */
app.use(authenticateApiKey);

/* ── 7. Sliding Window Rate Limiting (Redis-backed) ──────── */
app.use(slidingWindowRateLimiter);

/* ── 8. Health Check ─────────────────────────────────────── */
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

/* ── 9. API Routes ───────────────────────────────────────── */
app.use('/api', apiRouter);

/* ── 10. 404 Catch-All ───────────────────────────────────── */
app.all(/.*/, (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.originalUrl}`));
});

/* ── 11. Global Error Handler ────────────────────────────── */
app.use(errorHandler);

export { app };
