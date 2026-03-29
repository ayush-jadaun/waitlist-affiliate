# System Architecture Overview

The Waitlist & Viral Referral System is a multi-tenant SaaS platform that allows developers to embed a waitlist with built-in viral referral mechanics, reward tiers, A/B experiments, and webhook notifications into any product. A single API server handles all workloads; background processing is delegated to three BullMQ workers that share the same Redis instance.

---

## High-Level Architecture

```mermaid
graph TB
    subgraph Clients
        PublicApp[Public App / Widget]
        AdminUI[Admin Dashboard]
    end

    subgraph API["API Server (Fastify)"]
        direction TB
        PublicRoutes["Public Routes\n/api/v1/subscribe\n/api/v1/stats\n/api/v1/leaderboard"]
        AdminRoutes["Admin Routes\n/api/v1/admin/*"]
        Middleware["Middleware\nAPI Key Auth · JWT Auth\nRate Limiting · CORS"]
        Services["Services\nWaitlistService · ReferralService\nWebhookService · EventService\nPositionService"]
    end

    subgraph Workers["BullMQ Workers"]
        WebhookWorker["Webhook Dispatcher\nconcurrency: 3"]
        AnalyticsWorker["Analytics Aggregator\nconcurrency: 1"]
        PositionWorker["Position Recalculator\nconcurrency: 1"]
    end

    subgraph Storage
        Postgres[(PostgreSQL 16\n13 tables)]
        Redis[(Redis 7\nQueues + Cache)]
    end

    PublicApp -->|"X-API-Key"| PublicRoutes
    AdminUI -->|"Bearer JWT"| AdminRoutes
    PublicRoutes --> Middleware
    AdminRoutes --> Middleware
    Middleware --> Services
    Services -->|"read/write"| Postgres
    Services -->|"enqueue jobs"| Redis
    Redis --> WebhookWorker
    Redis --> AnalyticsWorker
    Redis --> PositionWorker
    WebhookWorker -->|"read/write"| Postgres
    WebhookWorker -->|"HTTP POST"| ExternalHooks[External Webhook URLs]
    AnalyticsWorker -->|"read/write"| Postgres
    PositionWorker -->|"read/write"| Postgres
    Services -->|"cache reads"| Redis
```

---

## Component Breakdown

### API Server (`apps/api`)

The API server is a [Fastify](https://fastify.dev/) application written in TypeScript. It starts in `apps/api/src/server.ts`, which wires together every subsystem before the server begins listening.

**Startup sequence:**
1. Validate required environment variables (`DATABASE_URL`, `REDIS_URL`, `ADMIN_JWT_SECRET`).
2. Create a Drizzle ORM database client and an ioredis client.
3. Decorate the Fastify instance with `db` and `redis` so all routes can access them.
4. Register `@fastify/cors` (origin list from `CORS_ORIGINS`) and `@fastify/rate-limit` (100 req/min per IP, backed by Redis).
5. Register `@fastify/jwt` and attach the `authenticateAdmin` decorator.
6. Register all routes.
7. Register the three BullMQ workers in-process.
8. Attach `SIGTERM`/`SIGINT` handlers for graceful shutdown (30 s timeout).

**Route groups:**

| Group | Auth | Prefix |
|---|---|---|
| Subscribe | API Key | `/api/v1/subscribe` |
| Stats | API Key | `/api/v1/stats` |
| Leaderboard | API Key | `/api/v1/leaderboard` |
| Admin Auth | None (setup) / None (login) | `/api/v1/admin/auth` |
| Admin Projects | JWT | `/api/v1/admin/project` |
| Admin Subscribers | JWT | `/api/v1/admin/subscribers` |
| Admin Rewards | JWT | `/api/v1/admin/rewards` |
| Admin Webhooks | JWT | `/api/v1/admin/webhooks` |
| Admin Experiments | JWT | `/api/v1/admin/experiments` |
| Admin Analytics | JWT | `/api/v1/admin/analytics` |
| Health | None | `/health` |

### Background Workers (`apps/api/src/workers`)

Three BullMQ workers run in the same Node.js process as the API server. They share the ioredis connection. Each worker is created via `createWorker()` in `lib/queue.ts`.

| Worker | Queue name | Concurrency | Responsibility |
|---|---|---|---|
| Webhook Dispatcher | `webhook` | 3 | Deliver webhook payloads; retry on failure |
| Analytics Aggregator | `analytics` | 1 | Upsert daily analytics rows |
| Position Recalculator | `position` | 1 | Apply position bumps after referral |

### Shared Package (`packages/shared`)

Contains types, Zod validation schemas, and constants shared between the API and any frontend packages.

| File | Contents |
|---|---|
| `types.ts` | TypeScript interfaces and union types |
| `schemas.ts` | Zod schemas for request validation |
| `constants.ts` | Feature flags, retry delays, cache TTLs, disposable domain list |

---

## Data Flow Diagrams

### Signup Flow

```mermaid
sequenceDiagram
    participant Client as Public App
    participant API as API Server
    participant DB as PostgreSQL
    participant WQ as webhook queue
    participant AQ as analytics queue

    Client->>API: POST /api/v1/subscribe\n{email, name, referralCode?, channel?}
    API->>API: Validate X-API-Key (SHA-256 hash lookup)
    API->>DB: SELECT project WHERE api_key_hash = ?
    DB-->>API: project row

    API->>API: Validate request body (Zod)

    alt maxSubscribers configured
        API->>DB: COUNT(*) FROM subscribers WHERE project_id = ?
        DB-->>API: count
        alt count >= maxSubscribers
            API-->>Client: 409 Waitlist is full
        end
    end

    alt referralCode provided and referral.enabled
        API->>DB: SELECT subscriber WHERE referral_code = ?
        DB-->>API: referrer row
    end

    API->>DB: SELECT subscriber WHERE project_id=? AND email=?
    DB-->>API: existing? (duplicate check)

    alt email already exists
        API-->>Client: 200 {existing subscriber data}
    else new subscriber
        API->>DB: SELECT MAX(position) WHERE project_id=?
        DB-->>API: maxPos (skipped in gated mode)
        API->>API: generateReferralCode() via nanoid
        API->>DB: INSERT INTO subscribers
        DB-->>API: new subscriber row

        alt referredBy set
            API->>DB: INSERT INTO referrals
        end

        API->>DB: INSERT INTO events (subscriber.created)
        DB-->>API: event row
        API->>WQ: add("dispatch", {eventId, projectId, type, data})
        API->>AQ: add("aggregate", {projectId, type, timestamp})

        API-->>Client: 201 {id, email, position, referralCode, status, totalSignups}
    end
```

### Referral Flow

```mermaid
sequenceDiagram
    participant API as API Server
    participant RS as ReferralService
    participant PS as PositionService
    participant DB as PostgreSQL
    participant ES as EventService

    Note over API: Referral record already inserted during subscribe

    API->>RS: processReferral(projectId, referrerId, referredId, config)
    RS->>ES: emit("referral.created", referrerId, {referredId})
    ES->>DB: INSERT INTO events
    ES->>DB: (enqueues webhook + analytics jobs)

    RS->>PS: applyPositionBump(db, referrerId, projectId, bumpAmount, maxBumps)
    PS->>DB: SELECT subscriber WHERE id = referrerId
    DB-->>PS: subscriber {position, ...}
    PS->>DB: COUNT(*) FROM subscribers WHERE referred_by = referrerId
    DB-->>PS: totalBumps

    PS->>PS: calculateNewPosition(currentPos, bumpAmount, maxBumps, totalBumps-1)
    Note over PS: newPos = max(1, currentPos - bumpAmount)\nif maxBumps reached → no change

    PS->>DB: UPDATE subscribers SET position = position+1\nWHERE projectId=? AND position BETWEEN newPos AND oldPos-1
    PS->>DB: UPDATE subscribers SET position = newPos WHERE id = referrerId
    PS-->>RS: newPosition

    RS->>ES: emit("position.changed", referrerId, {newPosition})

    RS->>RS: checkRewardUnlocks(projectId, referrerId)
    RS->>DB: COUNT(*) verified referrals for referrerId
    RS->>DB: SELECT reward_tiers WHERE project_id = ?
    loop each tier
        alt referralCount >= tier.threshold
            RS->>DB: SELECT reward_unlock (exists check)
            alt not yet unlocked
                RS->>DB: INSERT INTO reward_unlocks
                RS->>ES: emit("reward.unlocked", referrerId, {tierName, ...})
            end
        end
    end
```

### Webhook Delivery Flow

```mermaid
sequenceDiagram
    participant WQ as webhook queue (BullMQ)
    participant WW as Webhook Worker
    participant WS as WebhookService
    participant DB as PostgreSQL
    participant Ext as External Endpoint

    WQ->>WW: job {eventId, projectId, type, data}

    alt no endpointId (first dispatch)
        WW->>WS: getEndpointsForEvent(projectId, type)
        WS->>DB: SELECT webhook_endpoints WHERE active=true
        DB-->>WS: endpoints[]
        WS->>WS: filter by events[] array contains type
        WS-->>WW: matching endpoints[]
        loop each endpoint
            WW->>WW: deliverToEndpoint(...)
        end
    else retry dispatch (endpointId set)
        WW->>WW: deliverToEndpoint(endpointId, ...)
    end

    Note over WW: deliverToEndpoint
    WW->>DB: SELECT webhook_endpoint WHERE id = endpointId
    DB-->>WW: endpoint {url, secret, active}

    WW->>WW: Build JSON payload {id, type, data, timestamp}
    WW->>WW: signPayload(payload, secret) → sha256=<hex>

    WW->>Ext: POST endpoint.url\n Content-Type: application/json\n X-Webhook-Signature: sha256=...\n X-Webhook-Event: type
    alt success (2xx/3xx)
        Ext-->>WW: 200 OK
        WW->>WS: recordDelivery(..., statusCode=200, attempt)
        WS->>DB: INSERT INTO webhook_deliveries (deliveredAt=now, nextRetryAt=null)
    else failure (5xx or timeout)
        Ext-->>WW: 500 / timeout
        WW->>WS: recordDelivery(..., statusCode=500, attempt)
        WS->>DB: INSERT INTO webhook_deliveries (deliveredAt=null, nextRetryAt=now+delay)
        alt attempt < WEBHOOK_MAX_RETRIES (5)
            WW->>WQ: add("dispatch", {..., endpointId, attempt+1}, {delay: retryDelay})
        end
    end
```

### Analytics Aggregation Flow

```mermaid
flowchart LR
    E["Event emitted\n(subscriber.created,\nreferral.created, etc.)"]
    AQ["analytics queue\n(BullMQ)"]
    AW["Analytics Worker\n(concurrency 1)"]
    subgraph Queries["DB Queries (for date)"]
        Q1["COUNT signups"]
        Q2["COUNT referrals"]
        Q3["COUNT verified_referrals"]
        Q4["COUNT reward_unlocks"]
    end
    Upsert["INSERT INTO analytics_daily\nON CONFLICT DO UPDATE\n(projectId, date)"]
    KF["kFactor = verifiedReferrals / signups"]

    E --> AQ --> AW
    AW --> Q1 & Q2 & Q3 & Q4
    Q1 & Q2 & Q3 & Q4 --> KF --> Upsert
```

---

## Package Dependency Graph

```mermaid
graph LR
    API["apps/api"] --> Shared["packages/shared"]
    API --> Fastify["fastify"]
    API --> DrizzleORM["drizzle-orm"]
    API --> BullMQ["bullmq"]
    API --> IORedis["ioredis"]
    API --> Nanoid["nanoid"]
    API --> Zod["zod"]
    Shared --> Zod
```

---

## Technology Decisions

| Technology | Version | Rationale |
|---|---|---|
| **Fastify** | 4.x | Lower overhead than Express; built-in schema validation hooks; plugin system maps cleanly to route groups |
| **Drizzle ORM** | latest | Fully type-safe SQL builder; zero-overhead at runtime compared to ActiveRecord ORMs; migrations via drizzle-kit |
| **PostgreSQL** | 16 | ACID guarantees needed for position arithmetic; `ON CONFLICT DO UPDATE` for idempotent analytics upserts |
| **Redis / ioredis** | 7 / latest | BullMQ requires Redis for job queues; doubles as a response cache for leaderboard (60 s TTL) and stats (300 s TTL) |
| **BullMQ** | latest | Battle-tested Redis-backed queue; built-in delayed jobs (used for webhook retry backoff); per-queue concurrency |
| **nanoid** | latest | Cryptographically random, URL-safe referral codes; custom alphabet (alphanumeric) for readability |
| **Zod** | 3.x | Single source of truth for validation schemas shared between API and frontend; `.safeParse()` gives structured errors |
| **pnpm workspaces + Turborepo** | 9.x / latest | Monorepo toolchain; turborepo handles build caching and pipeline ordering |
| **Docker multi-stage build** | - | `deps` → `build` → `production` stages keep the final image small; dumb-init for proper PID 1 signal handling |
