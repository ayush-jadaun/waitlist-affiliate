# @waitlist/api

Fastify API server with BullMQ background workers for the Waitlist & Viral Referral System.

## Prerequisites

- Node.js 20+
- PostgreSQL 16
- Redis 7

## Getting Started

### 1. Start infrastructure

```bash
docker compose up -d postgres redis
```

This starts PostgreSQL on port `5434` and Redis on port `6381`.

### 2. Configure environment variables

Copy and edit the values below (see full reference further down):

```bash
export DATABASE_URL="postgres://waitlist:waitlist@localhost:5434/waitlist"
export REDIS_URL="redis://localhost:6381"
export ADMIN_JWT_SECRET="change-me-min-32-chars-long"
export PORT=3400
```

### 3. Run database migrations

```bash
pnpm --filter @waitlist/api db:migrate
```

### 4. Start the dev server

```bash
pnpm --filter @waitlist/api dev
```

The API is now available at `http://localhost:3400`.

## API Endpoints

### Public endpoints (require `X-API-Key` header)

| Method | Path                                | Description                            |
|--------|-------------------------------------|----------------------------------------|
| `GET`  | `/health`                           | Health check                           |
| `POST` | `/api/v1/subscribe`                 | Subscribe to the waitlist              |
| `GET`  | `/api/v1/subscribe/:email/status`   | Get a subscriber's status by email     |
| `GET`  | `/api/v1/leaderboard`               | Top referrers (`?limit=10`, max 100)   |
| `GET`  | `/api/v1/stats`                     | Public stats (signups, spots, referrals) |

### Admin endpoints (require `Authorization: Bearer <jwt>`)

**Auth**

| Method | Path                           | Description                                      |
|--------|--------------------------------|--------------------------------------------------|
| `POST` | `/api/v1/admin/auth/setup`     | Create the first admin account (one-time)        |
| `POST` | `/api/v1/admin/auth/login`     | Sign in and receive a JWT                        |

**Projects**

| Method | Path                           | Description                                      |
|--------|--------------------------------|--------------------------------------------------|
| `GET`  | `/api/v1/admin/project`        | List all projects                                |
| `POST` | `/api/v1/admin/project`        | Create a new project                             |
| `PUT`  | `/api/v1/admin/project/:id`    | Update a project's configuration                 |

**Subscribers**

| Method   | Path                                 | Description                                      |
|----------|--------------------------------------|--------------------------------------------------|
| `GET`    | `/api/v1/admin/subscribers`          | List subscribers (`?projectId=`, `?status=`, `?search=`, `?page=`, `?limit=`) |
| `PATCH`  | `/api/v1/admin/subscribers/:id`      | Update a subscriber's status                     |
| `POST`   | `/api/v1/admin/subscribers/bulk`     | Bulk approve / reject / ban subscribers          |

**Rewards**

| Method   | Path                           | Description                      |
|----------|--------------------------------|----------------------------------|
| `GET`    | `/api/v1/admin/rewards`        | List reward tiers (`?projectId=`)|
| `POST`   | `/api/v1/admin/rewards`        | Create a reward tier             |
| `PUT`    | `/api/v1/admin/rewards/:id`    | Update a reward tier             |
| `DELETE` | `/api/v1/admin/rewards/:id`    | Delete a reward tier             |

**Experiments**

| Method   | Path                                | Description                           |
|----------|-------------------------------------|---------------------------------------|
| `GET`    | `/api/v1/admin/experiments`         | List experiments (`?projectId=`)      |
| `POST`   | `/api/v1/admin/experiments`         | Create an experiment                  |
| `PATCH`  | `/api/v1/admin/experiments/:id`     | Toggle experiment active status       |
| `DELETE` | `/api/v1/admin/experiments/:id`     | Delete an experiment                  |

**Webhooks**

| Method   | Path                                          | Description                            |
|----------|-----------------------------------------------|----------------------------------------|
| `GET`    | `/api/v1/admin/webhooks`                      | List webhook endpoints (`?projectId=`) |
| `POST`   | `/api/v1/admin/webhooks`                      | Create a webhook endpoint              |
| `DELETE` | `/api/v1/admin/webhooks/:id`                  | Delete a webhook endpoint              |
| `GET`    | `/api/v1/admin/webhooks/:id/deliveries`       | List delivery log for an endpoint      |

**Analytics**

| Method | Path                                          | Description                                    |
|--------|-----------------------------------------------|------------------------------------------------|
| `GET`  | `/api/v1/admin/analytics/overview`            | Overview metrics (`?projectId=`)               |
| `GET`  | `/api/v1/admin/analytics/timeseries`          | Daily timeseries (`?projectId=&from=&to=`)     |
| `GET`  | `/api/v1/admin/analytics/cohorts`             | Cohort analysis (`?projectId=`)                |
| `GET`  | `/api/v1/admin/analytics/channels`            | Referral breakdown by channel (`?projectId=`)  |

## Database Schema

Managed with [Drizzle ORM](https://orm.drizzle.team) and PostgreSQL. Schema lives in `src/db/schema.ts`. Migrations are generated into `drizzle/migrations/`.

| Table                      | Description                                       |
|----------------------------|---------------------------------------------------|
| `projects`                 | Waitlist projects and their config (JSONB)        |
| `subscribers`              | Subscribers with position, status, referral code  |
| `referrals`                | Referral relationships between subscribers        |
| `reward_tiers`             | Reward tier definitions per project               |
| `reward_unlocks`           | Which subscribers have unlocked which tiers       |
| `events`                   | Raw event log (subscriber.created, etc.)          |
| `analytics_daily`          | Aggregated daily stats per project                |
| `analytics_cohorts`        | Weekly cohort referral depth analysis             |
| `experiments`              | A/B experiment definitions with variant weights   |
| `experiment_assignments`   | Subscriber-to-variant assignments                 |
| `webhook_endpoints`        | Registered outbound webhook URLs                  |
| `webhook_deliveries`       | Delivery attempt log with status codes            |
| `admin_users`              | Admin accounts                                    |

### Useful database commands

```bash
pnpm --filter @waitlist/api db:generate   # generate a new migration from schema changes
pnpm --filter @waitlist/api db:migrate    # apply pending migrations
pnpm --filter @waitlist/api db:studio     # open Drizzle Studio in the browser
```

## Background Workers

Three BullMQ workers run in-process alongside the Fastify server.

| Worker      | Concurrency | Description                                                        |
|-------------|-------------|--------------------------------------------------------------------|
| `webhook`   | 3           | Dispatches outbound webhook payloads with exponential-backoff retry (up to 5 attempts: 1m → 5m → 30m → 2h → 12h) |
| `analytics` | 1           | Aggregates raw events into daily analytics and cohort tables       |
| `position`  | 1           | Recalculates subscriber positions after referrals are verified     |

All workers are shut down gracefully on `SIGTERM`/`SIGINT` with a 30-second timeout.

## Environment Variables

| Variable           | Required | Default     | Description                                                     |
|--------------------|----------|-------------|-----------------------------------------------------------------|
| `DATABASE_URL`     | Yes      | —           | PostgreSQL connection string                                    |
| `REDIS_URL`        | Yes      | —           | Redis connection string                                         |
| `ADMIN_JWT_SECRET` | Yes      | —           | Secret for signing admin JWTs (minimum 32 characters recommended) |
| `PORT`             | No       | `3400`      | Port to listen on                                               |
| `HOST`             | No       | `0.0.0.0`   | Host to bind to                                                 |
| `CORS_ORIGINS`     | No       | `*`         | Comma-separated list of allowed CORS origins                    |
| `LOG_LEVEL`        | No       | `info`      | Pino log level (`trace`, `debug`, `info`, `warn`, `error`)      |

## Testing

```bash
# Unit tests
pnpm --filter @waitlist/api test:unit

# Integration tests (requires running PostgreSQL and Redis)
pnpm --filter @waitlist/api test:integration
```
