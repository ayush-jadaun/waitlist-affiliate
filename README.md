# Waitlist & Viral Referral System

A production-ready, embeddable waitlist management and viral referral platform. Deploy a self-hosted API, drop in a script tag or React components, and get viral growth loops, tier-based rewards, full analytics, and A/B testing out of the box.

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-466%20passing-brightgreen)
![License](https://img.shields.io/badge/license-Apache%202.0-blue)

---

## Features

- **Three waitlist modes** — pre-launch (position queue), gated access (admin approval), and viral growth (leaderboard-driven)
- **Viral referral tracking** — unique referral codes, chain tracking, fraud prevention (IP deduplication, email verification, disposable domain blocklist)
- **Tier-based rewards with position bumping** — configurable thresholds, reward types (`flag`, `code`, `custom`), and position recalculation via BullMQ workers
- **Full analytics** — K-factor tracking, daily time-series, weekly cohort analysis, A/B testing with per-variant metrics, share channel breakdown (Twitter, LinkedIn, WhatsApp, email, clipboard)
- **Webhook events** — 9 event types, HMAC-SHA256 signed payloads, exponential-backoff retry (5 attempts), full delivery log
- **Embeddable widget** — ~6KB drop-in `<script>` tag (`@waitlist/widget`), headless JS SDK (`@waitlist/sdk`), and React components (`@waitlist/react`)
- **Admin dashboard** — React SPA served from the API at `/admin` with real-time charts, subscriber management, reward configuration, experiment builder, and webhook manager
- **Redis-cached leaderboards and stats** — hot metrics served from cache with configurable TTL, aggregated in background workers

---

## Architecture

```mermaid
graph TD
    subgraph "npm packages"
        SDK["@waitlist/sdk\nHeadless JS client"]
        Widget["@waitlist/widget\nDrop-in script tag"]
        React["@waitlist/react\nReact components"]
    end

    subgraph "API Server (Fastify)"
        PublicAPI["Public API\n/api/v1/*"]
        AdminAPI["Admin API\n/api/v1/admin/*"]
        AdminSPA["Admin SPA\n/admin"]
    end

    subgraph "Background Workers (BullMQ)"
        Analytics["Analytics Aggregator"]
        Webhooks["Webhook Dispatcher"]
        Position["Position Recalculator"]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        Redis[(Redis)]
    end

    SDK -->|REST| PublicAPI
    Widget -->|REST| PublicAPI
    React -->|REST| PublicAPI

    PublicAPI --> PG
    AdminAPI --> PG
    PublicAPI --> Redis
    AdminAPI --> Redis

    Redis -->|BullMQ queues| Analytics
    Redis -->|BullMQ queues| Webhooks
    Redis -->|BullMQ queues| Position

    Analytics --> PG
    Position --> PG
```

### Monorepo Packages

| Package | Description |
|---|---|
| `apps/api` | Fastify API server with BullMQ workers, Drizzle ORM, and admin SPA serving |
| `apps/admin` | React + Tailwind + Recharts admin dashboard (served as static build from API) |
| `packages/sdk` | `@waitlist/sdk` — headless JavaScript client for all public API operations |
| `packages/widget` | `@waitlist/widget` — zero-dependency drop-in `<script>` embed (~6KB) |
| `packages/react` | `@waitlist/react` — React components wrapping the SDK |
| `packages/shared` | `@waitlist/shared` — shared Zod schemas, TypeScript types, and constants |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| API Framework | Fastify 5 |
| ORM | Drizzle ORM |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis 7 + BullMQ 5 |
| Validation | Zod |
| Admin UI | React 19 + Tailwind CSS 4 + Recharts + TanStack Query |
| Widget | Vite (ESM + UMD builds) |
| Monorepo | Turborepo + pnpm workspaces |
| Language | TypeScript 5.7 throughout |
| Containerization | Docker + Docker Compose |

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9.15.4+ (`npm install -g pnpm`)
- Docker and Docker Compose

### Steps

```bash
# 1. Clone the repository
git clone <repo-url> waitlist-referral
cd waitlist-referral

# 2. Install dependencies
pnpm install

# 3. Copy environment config
cp .env.example .env

# 4. Start PostgreSQL and Redis
docker compose up postgres redis -d

# 5. Run database migrations
pnpm db:migrate

# 6. Start the development server (API + admin watch mode in parallel)
pnpm dev
```

The API will be available at **http://localhost:3400** and the admin dashboard at **http://localhost:3400/admin**.

The admin dashboard (Vite dev server) runs at **http://localhost:5173** during development.

### First-Time Admin Setup

On first startup, the server reads `ADMIN_SETUP_EMAIL` and `ADMIN_SETUP_PASSWORD` from your `.env` and seeds the initial admin account. Log in at `/admin` with those credentials.

---

## API Reference

All public endpoints require an `x-api-key` header with a project API key. Admin endpoints require a JWT `Authorization: Bearer <token>` header obtained from `POST /api/v1/admin/auth/login`.

### Public API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Health check — returns `{ status: "ok" }` |
| `POST` | `/api/v1/subscribe` | API Key | Join the waitlist |
| `GET` | `/api/v1/subscribe/:email/status` | API Key | Get subscriber position, referral count, and unlocked rewards |
| `GET` | `/api/v1/leaderboard` | API Key | Top referrers (supports `?limit=N`, max 100) |
| `GET` | `/api/v1/stats` | API Key | Public stats: total signups, spots remaining, referrals made |

### Admin API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/admin/auth/login` | Authenticate and receive a JWT |
| `GET` | `/api/v1/admin/project` | Get current project configuration |
| `PUT` | `/api/v1/admin/project` | Update project configuration (mode, referral settings, etc.) |
| `GET` | `/api/v1/admin/subscribers` | List subscribers with filtering, search, and pagination |
| `PATCH` | `/api/v1/admin/subscribers/:id` | Approve, reject, or ban a subscriber |
| `POST` | `/api/v1/admin/subscribers/bulk` | Bulk approve or reject |
| `GET` | `/api/v1/admin/analytics/overview` | Real-time dashboard metrics (K-factor, today's signups, etc.) |
| `GET` | `/api/v1/admin/analytics/timeseries` | Time-series data with date range filter |
| `GET` | `/api/v1/admin/analytics/cohorts` | Weekly cohort analysis |
| `GET` | `/api/v1/admin/analytics/channels` | Share channel conversion breakdown |
| `CRUD` | `/api/v1/admin/rewards` | Manage reward tiers |
| `CRUD` | `/api/v1/admin/experiments` | Manage A/B tests |
| `CRUD` | `/api/v1/admin/webhooks` | Manage webhook endpoints |
| `GET` | `/api/v1/admin/webhooks/:id/deliveries` | Webhook delivery log |

### Example: POST /api/v1/subscribe

**Request**

```http
POST /api/v1/subscribe
x-api-key: wl_pk_your_api_key_here
Content-Type: application/json

{
  "email": "jane@example.com",
  "name": "Jane Smith",
  "referralCode": "abc12x",
  "channel": "twitter",
  "metadata": { "plan": "pro" }
}
```

**Response (201 Created — new subscriber)**

```json
{
  "id": "01hx...",
  "email": "jane@example.com",
  "position": 142,
  "referralCode": "xyz89k",
  "status": "waiting",
  "totalSignups": 5001
}
```

**Response (200 OK — already subscribed)**

```json
{
  "id": "01hx...",
  "email": "jane@example.com",
  "position": 89,
  "referralCode": "xyz89k",
  "status": "waiting",
  "totalSignups": 5001
}
```

---

## SDK Usage

### @waitlist/sdk — Headless JavaScript Client

```bash
npm install @waitlist/sdk
```

```typescript
import { WaitlistClient } from '@waitlist/sdk'

const client = new WaitlistClient({
  apiKey: 'wl_pk_...',
  baseUrl: 'https://your-api.com'
})

// Join the waitlist
const result = await client.subscribe({
  email: 'user@example.com',
  name: 'Jane',
  referralCode: 'abc12x',     // optional — from ?ref= query param
  channel: 'twitter',          // optional — for channel analytics
  metadata: { plan: 'pro' }   // optional — custom fields
})
// → { id, position, referralCode, status, totalSignups }

// Check subscriber status
const status = await client.getStatus('user@example.com')
// → { position: 89, referralCount: 3, rewards: ['early_access'], status: 'waiting' }

// Fetch public leaderboard
const leaderboard = await client.getLeaderboard({ limit: 10 })
// → [{ rank: 1, name: 'Top Referrer', referralCount: 47 }, ...]

// Fetch public stats
const stats = await client.getStats()
// → { totalSignups: 5001, spotsRemaining: 499, referralsMade: 312 }
```

### @waitlist/widget — Drop-in Embed

No build step. Add a single `<script>` tag to any HTML page and the widget self-initializes.

```html
<script
  src="https://unpkg.com/@waitlist/widget"
  data-api-key="wl_pk_..."
  data-api-url="https://your-api.com"
  data-theme="dark"
  data-accent="#4a9eff">
</script>
```

The widget renders an email signup form, shows the subscriber's position after signup, displays their referral link with share buttons (Twitter, LinkedIn, WhatsApp, email, clipboard), and shows tier progress.

### @waitlist/react — React Components

```bash
npm install @waitlist/react
# peerDep: react >= 18
```

```tsx
import { WaitlistForm, ReferralStatus } from '@waitlist/react'

function App() {
  return (
    <>
      {/* Signup form with built-in referral code detection */}
      <WaitlistForm
        apiKey="wl_pk_..."
        apiUrl="https://your-api.com"
        onSuccess={(subscriber) => {
          console.log('Position:', subscriber.position)
          console.log('Referral code:', subscriber.referralCode)
        }}
      />

      {/* Status panel for already-subscribed users */}
      <ReferralStatus
        email={currentUser.email}
        apiKey="wl_pk_..."
        apiUrl="https://your-api.com"
      />
    </>
  )
}
```

---

## Webhook Events

Register webhook endpoints in the admin dashboard or via the admin API. Each endpoint has its own HMAC secret and can filter to specific event types.

### Event Types

| Event | Fires when |
|---|---|
| `subscriber.created` | A new subscriber joins — includes position and referral source |
| `subscriber.verified` | Subscriber verifies their email |
| `subscriber.approved` | Admin approves a subscriber (gated mode) |
| `subscriber.rejected` | Admin rejects a subscriber |
| `referral.created` | A referred signup is verified and counted |
| `reward.unlocked` | A subscriber reaches a reward tier threshold |
| `position.changed` | A subscriber's position changes due to referral bump |
| `experiment.assigned` | A subscriber is assigned to an A/B test variant |
| `waitlist.milestone` | A configurable milestone is hit (e.g. 1000 signups) |

### Delivery

- Signed with `X-Waitlist-Signature: sha256=<hmac>` using a per-endpoint secret
- Exponential-backoff retry: 1 min, 5 min, 30 min, 2 hrs, 12 hrs (5 total attempts)
- Full delivery log (payload, HTTP response code, latency) in the admin dashboard
- Manual replay available from the webhooks page

### Example Payload

```json
{
  "event": "reward.unlocked",
  "timestamp": "2026-03-29T12:00:00.000Z",
  "projectId": "proj_01hx...",
  "data": {
    "subscriberId": "sub_01hx...",
    "email": "jane@example.com",
    "tier": {
      "name": "Early Access",
      "rewardType": "flag",
      "rewardValue": "early_access"
    },
    "referralCount": 5
  }
}
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `PORT` | No | `3400` | API server port |
| `HOST` | No | `0.0.0.0` | API server bind address |
| `LOG_LEVEL` | No | `info` | Pino log level (`debug`, `info`, `warn`, `error`) |
| `ADMIN_JWT_SECRET` | Yes | — | Secret for signing admin JWTs — min 32 characters |
| `ADMIN_SETUP_EMAIL` | No | — | Email for the initial admin account (seeded on first boot) |
| `ADMIN_SETUP_PASSWORD` | No | — | Password for the initial admin account |
| `CORS_ORIGINS` | No | — | Comma-separated list of allowed CORS origins |

### Waitlist Modes

Configure the `mode` per project from the admin dashboard or `PUT /api/v1/admin/project`.

| Mode | Behavior |
|---|---|
| `prelaunch` | Subscribers receive a numbered position. Referrals bump the referrer up the queue. Optional waitlist cap and auto-approve. |
| `gated` | No positions — subscribers enter a queue for admin review. Supports bulk approve/reject and auto-approve-if-referred rules. |
| `viral` | Everyone is "in" — the referral leaderboard and tier rewards drive sharing. Focus is on gamified growth, not access control. |

### Project Config Reference

```typescript
interface ProjectConfig {
  mode: 'prelaunch' | 'gated' | 'viral'
  name: string
  maxSubscribers?: number          // optional cap on total subscribers
  requireEmailVerification: boolean
  referral: {
    enabled: boolean
    positionBump: number           // positions gained per referral (default: 1)
    maxBumps?: number              // cap on total position gains per subscriber
  }
  deduplication: 'email' | 'email+ip'
  rateLimit: {
    window: string                 // e.g. "1m", "1h"
    max: number                    // max signups per window
  }
}
```

---

## Deployment

### Local Development (Docker Compose)

Brings up PostgreSQL and Redis only — the API runs locally via `pnpm dev` for hot-reload.

```bash
docker compose up postgres redis -d
pnpm dev
```

### Full Stack via Docker Compose

Builds and runs the full stack including the API container.

```bash
docker compose up --build
```

Services:
- PostgreSQL at `localhost:5434`
- Redis at `localhost:6381`
- API + Admin at `http://localhost:3400`

### Production Docker Build

The Dockerfile uses a three-stage build (deps → build → production) and runs as a non-root user.

```bash
# Build the image
docker build -t waitlist-referral .

# Run with production environment variables
docker run -p 3400:3400 \
  -e DATABASE_URL="postgres://user:pass@your-db:5432/waitlist" \
  -e REDIS_URL="redis://your-redis:6379" \
  -e ADMIN_JWT_SECRET="your-secret-min-32-chars-here" \
  -e CORS_ORIGINS="https://yourdomain.com" \
  waitlist-referral
```

### Required Production Environment Variables

```
DATABASE_URL=postgres://user:pass@host:5432/waitlist
REDIS_URL=redis://host:6379
ADMIN_JWT_SECRET=<random 32+ char string>
CORS_ORIGINS=https://yourdomain.com
```

---

## Testing

### Run All Tests

```bash
pnpm test
```

### Unit Tests Only

```bash
pnpm test:unit
```

Unit tests cover:
- Referral code generation and uniqueness
- Position calculation and bumping logic
- Waitlist service (subscribe, deduplication, status)
- Referral engine (chain creation, reward threshold detection)
- Webhook HMAC signing and payload construction
- API key middleware

### Integration Tests

Integration tests require a running PostgreSQL and Redis instance (use `docker compose up postgres redis -d`).

```bash
pnpm test:integration
```

Integration tests cover full HTTP round-trips for:
- Subscribe flow with referral codes
- Leaderboard caching and pagination
- Stats endpoint with Redis cache
- Admin auth (login, JWT validation)
- Admin project config (read/update)
- Admin subscriber management (list, approve, reject, bulk)
- Admin reward tier CRUD
- Admin webhook endpoint CRUD and delivery log
- Admin experiment CRUD
- Full end-to-end journey (signup → referral → reward unlock → webhook delivery)

### Test Count

**466 tests** across unit and integration suites.

---

## Project Structure

```
waitlist-referral/
├── apps/
│   ├── api/                        # Fastify API server
│   │   ├── src/
│   │   │   ├── db/                 # Drizzle schema and migrations
│   │   │   ├── middleware/         # API key auth, rate limiting
│   │   │   ├── routes/             # Public and admin route handlers
│   │   │   │   └── admin/          # Admin sub-routes (auth, project, subscribers, ...)
│   │   │   ├── services/           # Business logic (waitlist, referral, events)
│   │   │   ├── workers/            # BullMQ workers (analytics, webhook, position)
│   │   │   ├── __tests__/          # Unit and integration tests
│   │   │   │   └── integration/    # Integration test suite
│   │   │   └── server.ts           # Server bootstrap
│   │   ├── drizzle/                # SQL migration files
│   │   └── package.json
│   └── admin/                      # React admin dashboard
│       ├── src/
│       └── package.json
├── packages/
│   ├── sdk/                        # @waitlist/sdk
│   ├── widget/                     # @waitlist/widget
│   ├── react/                      # @waitlist/react
│   └── shared/                     # @waitlist/shared (types, schemas, constants)
├── docs/
│   └── superpowers/specs/          # Design specs
├── docker-compose.yml
├── Dockerfile
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .env.example
└── package.json
```

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) for full text.
