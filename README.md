# ⚽ Fútbol Data Aggregator API

> **High-Performance Soccer Data Aggregator & REST API** — Pulls live and historical data from [API-Football](https://www.api-football.com/), normalizes it into PostgreSQL via Prisma, and serves it through optimized, rate-limited, cached Express endpoints.

**Live API:** [https://futboldataaggregatorapi-production.up.railway.app](https://futboldataaggregatorapi-production.up.railway.app)

[![Live](https://img.shields.io/badge/Live-Railway-8B5CF6)](https://futboldataaggregatorapi-production.up.railway.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-black?logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7.8-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-pg_8.21-336791?logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-ioredis_5.11-DC382D?logo=redis)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-5.77-EA4C1D)](https://docs.bullmq.io/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?logo=socket.io)](https://socket.io/)
[![Vitest](https://img.shields.io/badge/Vitest-4.1-6E9F18?logo=vitest)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Badge versions are the floors of the ranges in `package.json` (`typescript` ^6.0.3, `express` ^5.2.1, `prisma` / `@prisma/client` / `@prisma/adapter-pg` ^7.8.0, `pg` ^8.21.0, `ioredis` ^5.11.0, `bullmq` ^5.77.6, `socket.io` ^4.8.3, `vitest` ^4.1.7). Node.js is `>=22.0.0` in `engines` and `22` in `.nvmrc`. PostgreSQL and Redis **server** versions are not pinned. Tests use Vitest only — Supertest is not a dependency. There is no GitHub Actions workflow, so there is no CI badge.

---

## 📐 Architecture

HTTP traffic and background sync share one process. `src/server.ts` listens, then attaches Socket.io and starts the BullMQ workers.

```
Request
  → helmet, CORS, compression, JSON body, pino-http
  → API key auth (optional) → Redis sliding-window rate limit
  → Routes (per-route Redis cache on some GETs)
  → Controllers → Services → Repositories → PostgreSQL (Prisma + pg adapter)
                              ↕
                    Integrations (API-Football)
                              ↕
                   BullMQ workers (Redis-backed)
                              ↓
                 Socket.io  (/api/v1/realtime)
```

| Layer | Responsibility |
|---|---|
| **Routes** | Mount `/api/v1` resources and attach cache middleware on selected GETs. They do not run request-body validation. |
| **Controllers** | Parse query/body values, choose the status code, and shape the JSON envelope. Business rules stay in services. |
| **Services** | Orchestration, not-found handling, API key hashing, and API-Football sync. |
| **Repositories** | Prisma queries only. |
| **Integrations** | API-Football HTTP client (`src/integrations/apiFootball.ts`). |
| **Workers** | Four BullMQ queues started from `src/workers/index.ts` when the server boots. |
| **Middleware** | Security headers, CORS, compression, request logs, optional API key auth, Redis sliding-window rate limit, Redis response cache, and a stricter in-memory limiter on API key creation. |
| **Config** | Zod-validated environment (`src/config/index.ts`). Invalid or missing required variables exit the process before listen. |

`src/middleware/validateRequest.ts` can validate `body`, `query`, or `params` with Zod, but no route mounts it. The Zod schema that actually runs on startup is the environment schema. Resource inputs are read in the controllers.

PostgreSQL is accessed through Prisma 7's driver adapter: `src/config/database.ts` builds a `pg` pool from the full `DATABASE_URL` and passes `PrismaPg` into `PrismaClient`. The connection string is **not** in `schema.prisma`. Root `prisma.config.ts` passes `DATABASE_URL` to Prisma CLI commands that open a database (`migrate`, `db push`, `studio`). `prisma generate` loads that config and still succeeds when `DATABASE_URL` is unset.

---

## 🗂️ Project Structure

```
├── prisma/
│   ├── schema.prisma            # Models only (no datasource URL — Prisma 7)
│   └── migrations/              # SQL migration history
├── prisma.config.ts             # Prisma 7 config; reads DATABASE_URL
├── src/
│   ├── config/                  # Env, logger, Prisma/pg, Redis, BullMQ, Socket.io
│   ├── controllers/             # HTTP handlers (leagues, teams, matches, players, API keys)
│   ├── integrations/            # API-Football client
│   ├── middleware/              # Errors, cache, auth, both rate limiters, unused validateRequest
│   ├── repositories/            # Prisma data access
│   ├── routes/                  # /api → /api/v1 resource routers
│   ├── services/                # CRUD services and sync services
│   ├── types/                   # Shared TypeScript types
│   ├── utils/                   # AppError, catchAsync, apiResponse
│   ├── workers/                 # BullMQ worker startup and shutdown
│   ├── app.ts                   # Express application factory
│   └── server.ts                # Listen, Socket.io, workers, graceful shutdown
├── tests/
│   ├── setup.ts                 # Sets test env vars (no database connection)
│   ├── unit/                    # AppError and apiResponse unit tests
│   └── integration/             # Placeholder (.gitkeep only)
├── eslint.config.mjs            # ESLint 10 flat config
├── commitlint.config.mjs        # Conventional Commits (Husky commit-msg)
├── .prettierrc                  # Prettier configuration
├── .env.example                 # Environment template
├── .nvmrc                       # Node.js 22
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 22.0.0 (`.nvmrc` is `22`)
- **PostgreSQL** reachable from `DATABASE_URL`. This repo does not pin a server major version; the Node driver is `pg` ^8.21.0. Create the database named in the URL before migrating.
- **Redis** server. [BullMQ's connection guide](https://docs.bullmq.io/guide/connections) requires Redis 6.2 or newer. This repo's client is `ioredis` ^5.11.0. `REDIS_URL` defaults to `redis://localhost:6379` when unset.
- **API-Football API key** → [Get one here](https://dashboard.api-football.com/)

`DATABASE_URL` and `API_FOOTBALL_KEY` are required. The process exits on startup if either is missing or not a valid URL.

### Environment

Copy `.env.example` and fill it in. Names and defaults match `src/config/index.ts`.

| Variable | Required | Default | Used for |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development`, `production`, or `test` |
| `PORT` | no | `3000` | HTTP listen port |
| `DATABASE_URL` | yes | — | App pool and Prisma CLI (`prisma.config.ts`) |
| `REDIS_URL` | no | `redis://localhost:6379` | Cache, sliding-window rate limit, BullMQ |
| `API_FOOTBALL_KEY` | yes | — | API-Football `x-apisports-key` header |
| `API_FOOTBALL_BASE_URL` | no | `https://v3.football.api-sports.io` | API-Football base URL |
| `RATE_LIMIT_WINDOW_MS` | no | `900000` | Only the **unmounted** `rateLimiter` in `src/middleware/rateLimiter.ts` |
| `RATE_LIMIT_MAX_REQUESTS` | no | `100` | Same. Changing these does not change live API limits. |
| `LOG_LEVEL` | no | `info` | Pino level (`fatal` through `trace`) |

Live request limits are hardcoded in `src/middleware/slidingWindowRateLimiter.ts` (anonymous) and stored on each API key row (authenticated). See [Edge Security](#-edge-security-api-key-provisioning--rate-limiting).

### Installation

```bash
# Clone the repository
git clone https://github.com/gunnarwrld/futbol_data_aggregator_api.git
cd futbol_data_aggregator_api

# Install dependencies (also installs Husky git hooks)
npm install

# Set up environment variables
cp .env.example .env
# Edit .env: DATABASE_URL and API_FOOTBALL_KEY are required

# Generate the Prisma client (does not need a running database)
npm run db:generate

# Apply migrations. DATABASE_URL must be set — prisma.config.ts passes it
# through as the datasource URL, and the target database must already exist.
npm run db:migrate

# Start the API, Socket.io, and BullMQ workers together
npm run dev
```

`npm run dev` is `tsx watch src/server.ts`. On listen it calls `initializeSocket` and `initializeWorkers`. With Redis and a valid API-Football key, scheduled sync jobs start registering immediately — you do not start workers separately.

`npm run db:push` (`prisma db push`) is available for prototyping against a database without writing a migration. `npm run db:seed` is declared as `tsx prisma/seed.ts`, but **`prisma/seed.ts` is not in the repository**, so that script fails until a seed file is added.

### Verify

The server must be running. These reads work with an empty database (they return empty lists, not seeded data).

```bash
# Health check — no pagination meta
curl http://localhost:3000/health

# API v1 list endpoints
curl http://localhost:3000/api/v1/leagues
curl http://localhost:3000/api/v1/teams
curl http://localhost:3000/api/v1/matches
curl http://localhost:3000/api/v1/matches/live
curl http://localhost:3000/api/v1/players
```

`GET /health` returns `{ success, data: { status, timestamp, uptime } }`. `/health` is excluded from pino auto-logging. It still passes through API key auth and the sliding-window limiter.

### Tests

```bash
npm test
```

Vitest runs `tests/**/*.test.ts`. Today that is `tests/unit/AppError.test.ts` and `tests/unit/apiResponse.test.ts`. `tests/setup.ts` sets dummy `DATABASE_URL`, `REDIS_URL`, and `API_FOOTBALL_KEY` values; the unit tests do not open those connections, so Postgres and Redis do not need to be up. `tests/integration/` contains only `.gitkeep`.

The Husky `pre-commit` hook runs `npm test`. `commit-msg` runs Commitlint.

---

## 📡 API Endpoints

List endpoints use a paginated envelope. `data` is an array:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Single-resource `GET`, `POST`, and `PUT` responses are `{ "success": true, "data": { } }` with no pagination `meta`, except API key creation (below). `DELETE` returns **204** with an empty body.

Errors from `AppError` look like:

```json
{
  "success": false,
  "error": {
    "message": "Match with id 'c6c4c0f2-b88e-4a6b-9c76-d444456913a6' not found",
    "code": "NOT_FOUND",
    "statusCode": 404
  }
}
```

### V1 Routes

Cache TTLs are the `cacheMiddleware` values on the route. Cached responses set `X-Cache: HIT` or `MISS`. `POST` / `PUT` / `DELETE` are not cached. Successful league, team, match, and player writes call `invalidateCache` with that resource's prefix (`leagues:*`, `teams:*`, `matches:*`, or `players:*`). API key routes are not cached.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness: `status`, `timestamp`, `uptime` |
| `GET` | `/api/v1/leagues` | List leagues (cached 5 minutes) |
| `GET` | `/api/v1/leagues/:id` | League by id (cached 10 minutes) |
| `POST` | `/api/v1/leagues` | Create a league |
| `PUT` | `/api/v1/leagues/:id` | Update a league |
| `DELETE` | `/api/v1/leagues/:id` | Delete a league |
| `GET` | `/api/v1/teams` | List teams (cached 5 minutes) |
| `GET` | `/api/v1/teams/:id` | Team by id (cached 10 minutes) |
| `POST` | `/api/v1/teams` | Create a team |
| `PUT` | `/api/v1/teams/:id` | Update a team |
| `DELETE` | `/api/v1/teams/:id` | Delete a team |
| `GET` | `/api/v1/matches` | List matches, including home and away team names (cached 2 minutes) |
| `GET` | `/api/v1/matches/live` | Matches with status `LIVE`, `IN_PLAY`, or `PAUSED`, plus the 5 newest events (cached 30 seconds) |
| `GET` | `/api/v1/matches/:id` | Match with league, both teams, and events ordered by minute (cached 60 seconds) |
| `POST` | `/api/v1/matches` | Create a match |
| `PUT` | `/api/v1/matches/:id` | Update a match |
| `DELETE` | `/api/v1/matches/:id` | Delete a match |
| `GET` | `/api/v1/players` | List players (cached 5 minutes) |
| `GET` | `/api/v1/players/:id` | Player by id, including the team. There is no player-stats model. (cached 10 minutes) |
| `POST` | `/api/v1/players` | Create a player |
| `PUT` | `/api/v1/players/:id` | Update a player |
| `DELETE` | `/api/v1/players/:id` | Delete a player |
| `POST` | `/api/v1/api-keys` | Generate a key (also limited to 10 requests/minute/IP) |
| `GET` | `/api/v1/api-keys` | List keys. `meta` is `{ "total": N }`, not page fields. Hashes are omitted. |
| `PATCH` | `/api/v1/api-keys/:id/revoke` | Revoke a key (`isActive: false`) |

There is no `GET /api/v1` index route. A request there falls through to the 404 handler.

### Query Parameters

Pagination and sort apply to every list route (`/leagues`, `/teams`, `/matches`, `/players`):

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | `1` | Page number. Values that coerce to `0` are treated as `1`. |
| `limit` | number | `20` | Page size. Values above `100` are clamped to `100`. |
| `sortBy` | string | see below | Passed through to Prisma `orderBy` |
| `sortOrder` | `asc` \| `desc` | see below | Sort direction |

| List | Default `sortBy` | Default `sortOrder` | Extra filters |
|------|------------------|---------------------|---------------|
| Leagues | `name` | `asc` | `country` (exact), `season` (exact) |
| Teams | `name` | `asc` | `name` (case-insensitive contains) |
| Matches | `matchDate` | `desc` | `leagueId`, `teamId` (home or away), `status`, `startDate`, `endDate` (`matchDate` bounds, parsed with `new Date`) |
| Players | `name` | `asc` | `teamId`, `position` (exact) |

`sortBy` is not allow-listed. An unknown field raises a Prisma client validation error. That class is not one of the mapped codes (`P2002`, `P2025`, `P2003`), so the handler responds with **500** `INTERNAL_ERROR`. Outside production the response message is the underlying error text.

---

## 🛠️ Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | `tsx watch src/server.ts` — HTTP server, Socket.io, and BullMQ workers |
| `npm run build` | `prisma generate && tsc`. Generate does not require `DATABASE_URL`; the running server does. |
| `npm start` | `node dist/server.js` after `build` |
| `npm run lint` | ESLint on `src/` and `tests/` |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier write for `src/**/*.ts` and `tests/**/*.ts` |
| `npm run format:check` | Prettier check, no writes |
| `npm test` | `vitest run` |
| `npm run test:watch` | Vitest watch mode |
| `npm run test:coverage` | Vitest with the v8 coverage provider. Thresholds in `vitest.config.ts` are 80% branches, functions, lines, and statements for `src/**/*.ts`. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run validate` | `typecheck`, then `lint`, `format:check`, and `test` |
| `npm run db:generate` | `prisma generate` |
| `npm run db:migrate` | `prisma migrate dev` |
| `npm run db:push` | `prisma db push` |
| `npm run db:seed` | `tsx prisma/seed.ts` — **the seed file is not in the repo** |
| `npm run db:studio` | Prisma Studio |

---

## 🏗️ Tech Stack

Versions below are the ranges declared in `package.json`.

| Technology | Purpose |
|------------|---------|
| **TypeScript** ^6.0.3 | Typecheck (`tsc`) and the language of `src/` |
| **Node.js** ≥ 22 | Runtime. `.nvmrc` selects 22. |
| **Express** ^5.2.1 | HTTP framework. The 404 handler uses a RegExp (`/.*/`) because Express 5's router does not accept the old `*` string. |
| **Prisma** ^7.8.0 | CLI, client, and `@prisma/adapter-pg`. Config lives in `prisma.config.ts`. |
| **`pg`** ^8.21.0 | PostgreSQL driver used by the Prisma adapter |
| **PostgreSQL** | Primary database. Server major is not pinned in the repo. |
| **ioredis** ^5.11.0 | Redis client for cache, rate-limit sorted sets, and the URL parsed for BullMQ |
| **BullMQ** ^5.77.6 | Repeatable sync jobs. BullMQ documents Redis ≥ 6.2 as the server requirement. |
| **Socket.io** ^4.8.3 | WebSocket push on path `/api/v1/realtime` |
| **Pino** ^10.3.1 and **pino-http** ^11.0.0 | JSON logs. `pino-pretty` is a dev dependency. |
| **Zod** ^4.4.3 | Environment validation at startup. Also imported by the unused `validateRequest` helper. |
| **Helmet** ^8.2.0, **cors** ^2.8.6, **compression** ^1.8.1 | Security headers, CORS (`origin: true`), response compression |
| **express-rate-limit** ^8.5.2 | In-memory limiter used only on `POST /api/v1/api-keys` (`strictRateLimiter`: 10 requests / 60 seconds). The exported global `rateLimiter` is not mounted. |
| **Vitest** ^4.1.7 | Unit tests (`@vitest/coverage-v8` for coverage). No Supertest. |
| **Husky** ^9.1.7 + **Commitlint** ^21.0.2 | `pre-commit` runs `npm test`; `commit-msg` runs Commitlint |
| **ESLint** ^10.4.1 + **typescript-eslint** ^8.60.0 | Flat config in `eslint.config.mjs` |
| **Prettier** ^3.8.3 | Formatting |
| **tsx** ^4.22.3 | Dev server and the seed script |

---

## ⚙️ BullMQ Distributed Workers

Sync runs inside the API process. BullMQ's repeatable jobs use Redis so only one worker performs a given tick when several servers are running. A `node-cron` loop on each server would call API-Football once per instance.

### Job Schedule

Schedules are registered with `upsertJobScheduler` in `src/workers/index.ts`.

| Queue | Schedule | What it does |
|---|---|---|
| `sync-leagues` | Cron `0 3 * * *` (daily at 03:00, server local time) | `syncLeaguesService.syncAll()` |
| `sync-teams` | Cron `0 4 * * *` (daily at 04:00) | `syncTeamsService.syncAll()` |
| `sync-matches` | Every 6 hours (`every: 6 * 60 * 60 * 1000`) | `syncMatchesService.syncAll()` |
| `sync-live-matches` | Every 60 seconds | `syncLiveMatchesService.syncLive()` |

League and team jobs are cron patterns, not "every 24 hours from boot". Match sync and live sync are interval jobs.

### Job Configuration

Defaults in `src/config/queue.ts`:

- **Retries**: 3 attempts, exponential backoff starting at 5 seconds (5s → 10s → 20s), except live matches
- **Live matches**: scheduler opts set `attempts: 1`, so a failed tick is not retried; the next 60-second tick replaces it
- **Cleanup**: completed jobs kept for 1 hour (max 100); failed jobs kept for 24 hours (max 500)
- **Concurrency**: 1 per worker

BullMQ opens its own Redis connection. `src/config/queue.ts` passes only the hostname and port parsed from `REDIS_URL` (`maxRetriesPerRequest: null`). Username, password, a logical database index, and `rediss://` TLS are not forwarded. The cache and rate-limit client is a separate ioredis instance created with the full `REDIS_URL`, so those features do honor auth and TLS. A password-protected Redis will serve cache and rate limits while BullMQ fails to connect unless the instance also allows unauthenticated access on that host and port.

Graceful shutdown (`SIGTERM`, `SIGINT`, unhandled rejection, uncaught exception) closes Socket.io, workers, queues, Prisma, and Redis, and force-exits after 10 seconds.

---

## ⚡ Real-Time Push Layer

Socket.io is attached to the same HTTP server. The path is `/api/v1/realtime`. CORS for the socket server is `origin: '*'` (the Express CORS config is separate and reflects the request origin).

`sync-live-matches` only updates fixtures already stored under `Match.externalId`. When the home score, away score, or status differs from the row, it emits `match:update` to rooms `match:{id}` and `live-matches`:

```json
{ "matchId": "uuid", "homeScore": 1, "awayScore": 0, "status": "LIVE" }
```

When a fixture event is not already stored for that match, team, minute, and mapped type, it inserts a `MatchEvent` and emits `match:event` with that row to the same two rooms. Mapped types include `GOAL`, `YELLOW_CARD`, `RED_CARD`, `SUBSTITUTION`, and `VAR`.

### Connecting & Subscribing

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", { path: "/api/v1/realtime" });

socket.emit("subscribe:live-matches");
socket.emit("subscribe:match", "c6c4c0f2-b88e-4a6b-9c76-d444456913a6");

socket.on("match:update", (payload) => {
  console.log(payload.matchId, payload.homeScore, payload.awayScore);
});

socket.on("match:event", (event) => {
  console.log(event.eventType, event.minute);
});

socket.emit("unsubscribe:match", "c6c4c0f2-b88e-4a6b-9c76-d444456913a6");
socket.emit("unsubscribe:live-matches");
```

Replace the host with the [live API](https://futboldataaggregatorapi-production.up.railway.app) when connecting to the deployed server. The Socket.io path stays `/api/v1/realtime`.

---

## 🔐 Edge Security: API Key Provisioning & Rate Limiting

Three rate-limiter exports exist. The sliding-window limiter is the one on normal API traffic.

1. **`slidingWindowRateLimiter`** — mounted globally in `src/app.ts` after optional API key auth. Redis sorted-set log, 1-hour window.
2. **`strictRateLimiter`** — `express-rate-limit`, in memory, **only** on `POST /api/v1/api-keys` (10 requests per 60 seconds). It is not shared across server instances.
3. **`rateLimiter`** — also `express-rate-limit`, configured from `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX_REQUESTS`. Nothing mounts it.

### Tiers (sliding window)

| Tier | Limit | Identifier |
|---|---|---|
| Anonymous (no `x-api-key`) | 50 requests/hour | Client IP |
| `standard` key | 1,000 requests/hour unless `rateLimit` is set on create | API key id |
| `premium` key | 5,000 requests/hour unless `rateLimit` is set on create | API key id |

A missing header is anonymous access, not a 401. An unknown, revoked, or expired key is **401** and does not fall through as anonymous.

The app never calls `express.set('trust proxy', ...)`. Behind a reverse proxy, `req.ip` is the proxy address, so the anonymous sliding window and the API-key creation limiter are shared by every client that arrives through that proxy. Authenticated limits are keyed by API key id and are not affected.

The Redis pipeline, per request, removes scores older than the window, adds the current timestamp, counts the set, and sets a TTL of one hour. If Redis throws or the pipeline returns null, the limiter **fails open** (the request continues and a warning is logged).

Responses that pass the limiter include:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 997
X-RateLimit-Reset: 3600
```

`X-RateLimit-Reset` is the full window length in seconds (3600), not a timestamp. A 429 also sets `Retry-After` to that same value. The 429 body uses `error.code` `RATE_LIMIT_EXCEEDED`.

### Generating an API Key

`name` is required. `tier` is `standard` (default) or `premium`. Optional `rateLimit` overrides the tier default. Optional `expiresAt` is parsed with `new Date`.

```bash
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name": "My Mobile App", "tier": "standard"}'
```

```json
{
  "success": true,
  "data": {
    "rawKey": "fda_<64 hex chars>",
    "apiKey": {
      "id": "uuid",
      "name": "My Mobile App",
      "prefix": "fda_a1b2c3d4",
      "tier": "standard",
      "rateLimit": 1000,
      "isActive": true,
      "expiresAt": null,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  },
  "meta": {
    "warning": "Store the rawKey securely — it will NOT be shown again. Only the hashed version is stored."
  }
}
```

The raw key is `fda_` plus 32 random bytes as hex (64 hex characters). Only the SHA-256 hex digest is stored. `prefix` is the first 12 characters (`fda_` plus 8 hex characters).

### Using the Key

```bash
curl http://localhost:3000/api/v1/leagues \
  -H "x-api-key: fda_<64 hex chars>"
```

---

## 📝 Commit Convention

Husky + Commitlint enforce [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — New feature
- `fix:` — Bug fix
- `chore:` — Tooling, config, dependencies
- `refactor:` — Code restructuring (no behavior change)
- `docs:` — Documentation
- `test:` — Adding or updating tests
- `perf:` — Performance improvement
- `ci:` — CI/CD changes

---

## 📄 License

[MIT](./LICENSE) © Gunnar Arias
