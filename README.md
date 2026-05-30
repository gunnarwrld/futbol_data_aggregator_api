# ⚽ Fútbol Data Aggregator API

> **High-Performance Soccer Data Aggregator & REST API** — Pulls live and historical data from [API-Football](https://www.api-football.com/), normalizes it into PostgreSQL via Prisma, and serves it through optimized, rate-limited, cached Express endpoints.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22_LTS-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-black?logo=express)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## 📐 Architecture

This project follows a **strict layered architecture** with clean separation of concerns:

```
Request → Routes → Controllers → Services → Repositories → Database
                                     ↕
                               Integrations (API-Football)
                                     ↕
                          BullMQ Workers (Redis-backed)
                                     ↓
                        Real-Time Push (Socket.io)
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
│   ├── prisma.config.ts         # Prisma 7 configuration
│   └── migrations/              # SQL migration history
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
├── .eslintrc.cjs                # ESLint configuration
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

### Installation

```bash
# Clone the repository
git clone https://github.com/gunnarwrld/futbol_data_aggregator_api.git
cd futbol_data_aggregator_api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL, Redis URL, and API key

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Start development server
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
| `npm test` | Run tests with Vitest |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run typecheck` | TypeScript type checking |
| `npm run validate` | Run all checks (typecheck + lint + format + test) |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio |

---

## 🏗️ Tech Stack

| Technology | Purpose |
|------------|---------|
| **TypeScript** | Type safety & developer experience |
| **Express** | HTTP framework |
| **Prisma** | ORM & database toolkit |
| **PostgreSQL** | Primary relational database |
| **Redis** | Caching layer, rate limit store & BullMQ job queue backend |
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
