# ⚽ Fútbol Data Aggregator API

> **High-Performance Soccer Data Aggregator & REST API** — Pulls live and historical data from [API-Football](https://www.api-football.com/), normalizes it into PostgreSQL via Prisma, and serves it through optimized, rate-limited, cached Express endpoints.

[![CI](https://github.com/gunnarwrld/futbol_data_aggregator_api/actions/workflows/ci.yml/badge.svg)](https://github.com/gunnarwrld/futbol_data_aggregator_api/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/line_coverage-%E2%89%A590%25-brightgreen)](https://github.com/gunnarwrld/futbol_data_aggregator_api/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## 📐 Architecture

This project follows a **strict layered architecture** with clean separation of concerns. BullMQ workers run in the API process and use Redis as a distributed lock, so scaling the API does not double-fetch API-Football.

```mermaid
flowchart TD
  clients[HTTP clients]
  sockets[Socket.io clients]
  health["GET /health"]
  auth[API key middleware]
  limit[Sliding-window rate limiter]
  routes[Routes and controllers]
  cache[Redis response cache]
  services[Services]
  repos[Repositories]
  db[(PostgreSQL)]
  redis[(Redis)]
  workers[BullMQ workers]
  football[API-Football]

  clients --> health
  clients --> auth --> limit --> routes
  routes --> cache
  cache --> redis
  routes --> services --> repos --> db
  services --> football
  workers --> redis
  workers --> services
  workers --> sockets
```

| Layer | Responsibility |
|---|---|
| **Routes** | HTTP verb → controller mapping, validation middleware |
| **Controllers** | Request parsing, response formatting. **Zero business logic.** |
| **Services** | Business rules, orchestration, error handling |
| **Repositories** | Database queries via Prisma. **Zero business logic.** |
| **Integrations** | Third-party API clients (API-Football) |
| **Workers** | BullMQ distributed job processors for data synchronization |
| **Middleware** | Cross-cutting concerns (caching, rate limiting, validation, error handling) |

---

## 🗂️ Project Structure

```
├── prisma/
│   ├── schema.prisma            # Database schema & models
│   └── migrations/              # SQL migration history
├── prisma.config.ts             # Prisma 7 configuration
├── Dockerfile                   # Multi-stage production image
├── docker-compose.yml           # API, PostgreSQL 16, and Redis 7
├── .github/workflows/ci.yml     # Lint, typecheck, tests, image build
├── src/
│   ├── config/                  # Environment, logger, DB, Redis, BullMQ queue setup
│   ├── controllers/             # HTTP request/response handlers
│   ├── integrations/            # Third-party API clients (API-Football)
│   ├── middleware/              # Express middleware (errors, cache, rate limit, validation)
│   ├── repositories/            # Data access layer (Prisma queries)
│   ├── routes/                  # Route definitions (versioned: v1, v2, ...)
│   ├── services/                # Business logic + sync services
│   ├── types/                   # Shared TypeScript type definitions
│   ├── utils/                   # Utilities (AppError, catchAsync, apiResponse)
│   ├── workers/                 # BullMQ worker initialization & scheduling
│   ├── app.ts                   # Express application factory
│   └── server.ts                # Entry point with graceful shutdown
├── tests/
│   ├── unit/                    # Unit tests
│   └── integration/             # Integration tests
├── eslint.config.mjs            # ESLint configuration
├── .prettierrc                  # Prettier configuration
├── tsconfig.json                # TypeScript configuration
├── vitest.config.ts             # Test configuration
└── package.json                 # Project manifest
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 22.0.0
- **PostgreSQL** ≥ 15
- **Redis** ≥ 7
- **API-Football API key** → [Get one here](https://dashboard.api-football.com/)

### Docker Compose

Compose starts PostgreSQL 16, Redis 7, and the API. The image applies migrations on startup. Workers start with the API process; there is no separate worker container. The database password in this file is a local placeholder.

```bash
git clone https://github.com/gunnarwrld/futbol_data_aggregator_api.git
cd futbol_data_aggregator_api

# Optional: put a real key in .env. Compose reads it for API_FOOTBALL_KEY.
cp .env.example .env

docker compose up --build
```

The API listens on `http://localhost:3000`. Postgres is published on `localhost:5432` and Redis on `localhost:6379` (`futbol` / `futbol`, database `futbol_data`). Sync jobs call API-Football and fail until `API_FOOTBALL_KEY` is a real key. The HTTP API still serves data you insert yourself.

### Local Node process

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run dev
```

### Verify

```bash
# Health check
curl http://localhost:3000/health

# API v1 endpoints
curl http://localhost:3000/api/v1/leagues
curl http://localhost:3000/api/v1/teams
curl http://localhost:3000/api/v1/matches
curl http://localhost:3000/api/v1/matches/live
curl http://localhost:3000/api/v1/players
```

---

## 📡 API Endpoints

All endpoints return a standardized JSON envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### V1 Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/api/v1/leagues` | List all leagues |
| `GET` | `/api/v1/leagues/:id` | Get league by ID |
| `POST` | `/api/v1/leagues` | Create a league |
| `PUT` | `/api/v1/leagues/:id` | Update a league |
| `DELETE` | `/api/v1/leagues/:id` | Delete a league |
| `GET` | `/api/v1/teams` | List all teams |
| `GET` | `/api/v1/teams/:id` | Get team by ID |
| `POST` | `/api/v1/teams` | Create a team |
| `PUT` | `/api/v1/teams/:id` | Update a team |
| `DELETE` | `/api/v1/teams/:id` | Delete a team |
| `GET` | `/api/v1/matches` | List all matches |
| `GET` | `/api/v1/matches/live` | Get live matches (cached 30s) |
| `GET` | `/api/v1/matches/:id` | Get match by ID (with events & stats) |
| `POST` | `/api/v1/matches` | Create a match |
| `PUT` | `/api/v1/matches/:id` | Update a match |
| `DELETE` | `/api/v1/matches/:id` | Delete a match |
| `GET` | `/api/v1/players` | List all players |
| `GET` | `/api/v1/players/:id` | Get player by ID (with stats) |
| `POST` | `/api/v1/players` | Create a player |
| `PUT` | `/api/v1/players/:id` | Update a player |
| `DELETE` | `/api/v1/players/:id` | Delete a player |
| `POST` | `/api/v1/api-keys` | Generate a new API key |
| `GET` | `/api/v1/api-keys` | List all API keys |
| `PATCH` | `/api/v1/api-keys/:id/revoke` | Revoke an API key |

### Query Parameters

All list endpoints support:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `limit` | number | 20 | Items per page (max: 100) |
| `sortBy` | string | varies | Sort field |
| `sortOrder` | `asc` \| `desc` | `asc` | Sort direction |

---

## 🛠️ Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot-reload (tsx) |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Run ESLint with auto-fix |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without changes |
| `npm test` | Run unit and integration tests |
| `npm run test:unit` | Unit tests only. No database required |
| `npm run test:integration` | HTTP tests against Postgres and Redis |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Tests plus the v8 coverage report |
| `npm run typecheck` | TypeScript type checking |
| `npm run validate` | Run all checks (typecheck + lint + format + test) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

---

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript 6** | Type safety & developer experience |
| **Node.js 22** | Runtime |
| **Express 5.2** | HTTP framework |
| **Prisma 7** | ORM & database toolkit, with the `pg` driver adapter |
| **PostgreSQL 16** | Primary relational database |
| **Redis 7** | Caching layer, rate limit store & BullMQ job queue backend |
| **BullMQ** | Distributed job queue for API-Football sync workers |
| **Socket.io** | Real-time push layer for live match updates via WebSockets |
| **Pino** | Structured JSON logging |
| **Zod** | Runtime schema validation |
| **Vitest** | Unit & integration testing |
| **Husky + Commitlint** | Git hook enforcement of Conventional Commits |
| **ESLint** | Code quality & consistency |
| **Prettier** | Code formatting |

---

## ⚙️ BullMQ Distributed Workers

Instead of basic cron jobs (which would duplicate work if scaled to multiple servers), this project uses **[BullMQ](https://docs.bullmq.io/)** — a Redis-backed distributed job queue that **guarantees exactly-once execution per interval**, even across 10+ server instances.

### Why BullMQ?

If this API gets popular and you scale it by deploying two backend servers to handle the traffic, a standard cron package (like `node-cron`) will run on **both servers simultaneously**. This means:
- You fetch the external API **twice** at the exact same second
- You immediately burn through your API-Football rate limits
- You potentially cause database collisions from duplicate inserts

BullMQ solves this by using Redis as a **distributed lock**. Only one server picks up each job.

### Job Schedule

| Queue | Interval | Description |
|---|---|---|
| `sync-leagues` | Daily at 3:00 AM | Fetches all leagues from API-Football |
| `sync-teams` | Daily at 4:00 AM | Fetches teams per tracked league |
| `sync-matches` | Every 6 hours | Catches newly scheduled fixtures |
| `sync-live-matches` | Every 60 seconds | Real-time score & event updates |

### Job Configuration

- **Retries**: 3 attempts with exponential backoff (5s → 10s → 20s)
- **Cleanup**: Completed jobs kept for 1 hour, failed jobs kept for 24 hours
- **Concurrency**: 1 job at a time per worker to respect API-Football rate limits
- **Live matches**: No retries — the next 60-second interval handles it

---

## ⚡ Real-Time Push Layer

The API features a real-time push layer powered by **Socket.io**. Instead of having mobile or web clients constantly poll the server for live match updates, the BullMQ worker broadcasts changes the moment they happen.

When the `sync-live-matches` worker fetches data from API-Football every 60 seconds:
1. It compares the external data with the PostgreSQL state.
2. If the score or status changed, it broadcasts a `match:update` event.
3. If a new event occurred (goal, red card, substitution), it broadcasts a `match:event` event.

### Connecting & Subscribing

Clients connect to `/api/v1/realtime` and can subscribe to global or match-specific rooms:

```javascript
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", { path: "/api/v1/realtime" });

// Subscribe to ALL live matches
socket.emit("subscribe:live-matches");

// Subscribe to a specific match
socket.emit("subscribe:match", "c6c4c0f2-b88e-4a6b-9c76-d444456913a6");

// Listen for score updates
socket.on("match:update", (payload) => {
  console.log("Score updated!", payload.homeScore, payload.awayScore);
});

// Listen for goals, cards, etc.
socket.on("match:event", (event) => {
  if (event.eventType === "GOAL") alert("GOAL!!!");
});
```

---

## 🔐 Edge Security: API Key Provisioning & Rate Limiting

The API is protected by a **Redis-backed sliding window rate limiter** with tiered access control via API keys.

### The Problem

Without edge security, a single user writing a bad script could hit the Express server 10,000 times a second, crushing the database and burning bandwidth.

### The Solution

| Tier | Limit | Identifier |
|---|---|---|
| **Anonymous** (no key) | 50 requests/hour | IP address |
| **Standard** API key | 1,000 requests/hour | API key ID |
| **Premium** API key | 5,000 requests/hour | API key ID |

### Sliding Window Algorithm

Instead of a fixed-window counter (which allows double-burst attacks at window boundaries), this uses a **Sliding Window Log** algorithm:

1. Each request adds a timestamped entry to a Redis sorted set
2. Entries older than 1 hour are atomically pruned
3. The remaining count is checked against the tier limit
4. All three operations run in a single Redis pipeline (one round-trip)

### Generating an API Key

```bash
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name": "My Mobile App", "tier": "standard"}'
```

Response:
```json
{
  "success": true,
  "data": {
    "rawKey": "fda_a1b2c3d4e5f6...",
    "apiKey": {
      "id": "uuid",
      "name": "My Mobile App",
      "prefix": "fda_a1b2c3d4",
      "tier": "standard",
      "rateLimit": 1000
    }
  },
  "meta": {
    "warning": "Store the rawKey securely — it will NOT be shown again."
  }
}
```

### Using the Key

```bash
curl http://localhost:3000/api/v1/leagues \
  -H "x-api-key: fda_a1b2c3d4e5f6..."
```

Every response includes standard rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 997
X-RateLimit-Reset: 3600
```

### Security Design

- **Keys are hashed (SHA-256)** at rest — the raw key is shown once on creation
- **Expired or revoked keys** return `401 Unauthorized`
- **Rate limiter fails open** — if Redis goes down, requests are allowed through
- **Rejected requests do not consume the window** — the sorted-set entry is removed when the limit is exceeded
- **`GET /health` is exempt** from authentication and the sliding window, so orchestrator probes are not capped at 50/hour
- **Key creation is rate-limited** by an in-memory strict limiter to prevent abuse

---

## 🧪 Tests

Unit tests cover the sliding-window rate limiter, response cache, Zod request validation, error mapping, API-key hashing, the resource services, and the API-Football sync services. API-Football is mocked. Integration tests boot the Express app with Supertest against a real Postgres database and Redis. They exercise CRUD, pagination, cache hit/miss, API-key auth, and the hourly limit.

Coverage is measured with Vitest's v8 provider on the request path (controllers, services, repositories, middleware, and the API-Football client). Process bootstrap is excluded: `server.ts`, the BullMQ worker wiring, the Socket.io server, and the Redis/Postgres connection modules. The current suite covers **96.4% of lines**, **95.7% of statements**, **92.1% of functions**, and **88.1% of branches**. CI fails if those fall below 90%, 90%, 85%, and 80%. The workflow prints the exact percentages in the job summary and uploads the `coverage/` report.

```bash
# Postgres and Redis. The Compose init script also creates futbol_data_test.
docker compose up -d postgres redis

npm run test:unit
npm run test:integration
npm run test:coverage
```

`tests/integration/globalSetup.ts` creates `futbol_data_test` if it is missing and runs `prisma migrate deploy`. Default URLs:

```bash
DATABASE_URL=postgresql://futbol:futbol@localhost:5432/futbol_data_test
REDIS_URL=redis://127.0.0.1:6379/1
```

CI uses the same commands with GitHub Actions service containers (`postgres:16` and `redis:7`), then builds the production image with `docker build`.

## 📝 Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

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
