# Deployment Guide

---

## Local Development (Docker Compose)

The `docker-compose.yml` at the repo root spins up three services: PostgreSQL 16, Redis 7, and the API server.

```bash
# Start all services
docker compose up

# Start in background
docker compose up -d

# View logs
docker compose logs -f api

# Stop and remove containers (keeps volumes)
docker compose down

# Stop and remove containers AND volumes (fresh slate)
docker compose down -v
```

Service ports:

| Service | Container Port | Host Port |
|---|---|---|
| PostgreSQL | 5432 | 5434 |
| Redis | 6379 | 6381 |
| API | 3400 | 3400 |

The API waits for both Postgres and Redis health checks (`pg_isready` and `redis-cli ping`) before starting.

### Running Without Docker

```bash
# Install dependencies
pnpm install

# Start Postgres and Redis manually (or via Docker)
docker compose up postgres redis -d

# Run database migrations
pnpm --filter api db:migrate

# Start the API in development mode
pnpm --filter api dev
```

---

## Production with Docker

### Build the Image

```bash
docker build -t waitlist-api:latest .
```

The Dockerfile uses a three-stage build:

| Stage | Base | Purpose |
|---|---|---|
| `deps` | `node:20-alpine` | Install all dependencies with pnpm |
| `build` | `deps` | Run `pnpm build` to compile TypeScript |
| `production` | `node:20-alpine` | Copy only built artifacts; no source or dev tools |

The production image:
- Uses `dumb-init` as PID 1 (correct signal handling)
- Runs as the `waitlist` user (UID 1001, non-root)
- Exposes port 3400

### Run in Production

```bash
docker run -d \
  --name waitlist-api \
  -p 3400:3400 \
  -e DATABASE_URL="postgres://user:pass@db-host:5432/waitlist?sslmode=require" \
  -e REDIS_URL="redis://:password@redis-host:6379" \
  -e ADMIN_JWT_SECRET="$(openssl rand -hex 32)" \
  -e CORS_ORIGINS="https://yourapp.com,https://admin.yourapp.com" \
  -e LOG_LEVEL="info" \
  waitlist-api:latest
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection URL. Format: `postgres://user:pass@host:port/dbname` |
| `REDIS_URL` | Yes | — | Redis connection URL. Format: `redis://[:password@]host:port` |
| `ADMIN_JWT_SECRET` | Yes | — | Secret for signing admin JWTs. Min 32 chars. Use `openssl rand -hex 32`. |
| `PORT` | No | `3400` | HTTP port to listen on |
| `HOST` | No | `0.0.0.0` | Network interface to bind. Use `0.0.0.0` inside Docker. |
| `CORS_ORIGINS` | No | `*` | Comma-separated list of allowed CORS origins. **Always set in production.** |
| `LOG_LEVEL` | No | `info` | Fastify log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal` |

---

## Database Setup and Migrations

### First-Time Setup

```bash
# Apply all pending migrations
pnpm --filter api db:migrate
```

This reads migration files from `apps/api/drizzle/` and applies them in order. The migration files are included in the Docker production image.

### In Docker/Kubernetes

Run migrations as an init container or as a pre-start command:

```bash
# As a separate migration step before starting the app
node apps/api/dist/db/migrate.js

# Or in a Kubernetes init container using the same image
command: ["node", "apps/api/dist/db/migrate.js"]
```

### Creating New Migrations

```bash
# Generate a migration from schema changes
pnpm --filter api db:generate

# Apply the new migration
pnpm --filter api db:migrate
```

Never edit a committed migration file. Always create a new one.

---

## Redis Configuration

### Minimal Configuration

No special Redis configuration is required for development. The default Redis setup works.

### Production Recommendations

1. **Enable authentication:** Set a password with `requirepass` in `redis.conf`. Include it in `REDIS_URL`: `redis://:yourpassword@host:6379`.

2. **Persistence:** Enable AOF (`appendonly yes`) or RDB snapshots to survive restarts. BullMQ queue data lives in Redis — a Redis restart without persistence loses pending jobs.

3. **Memory limit:** Set `maxmemory` and `maxmemory-policy allkeys-lru` to prevent unbounded growth. BullMQ job data and cache entries will be evicted under memory pressure.

4. **TLS:** Use `rediss://` (with double s) in `REDIS_URL` for TLS connections to Redis.

---

## Scaling Considerations

### Horizontal Scaling the API

The API server is stateless except for the ioredis connection. Multiple instances can run behind a load balancer.

**Important:** Each API instance also runs the three BullMQ workers in-process. With N API instances, there will be N sets of workers all consuming from the same queues. This is safe because BullMQ uses Redis atomic operations to ensure each job is processed by exactly one worker.

However, running workers in every API instance means more concurrency than intended when scaling horizontally:
- Webhook Dispatcher: effective concurrency = `3 × N instances`
- Analytics Aggregator: effective concurrency = `1 × N instances`
- Position Recalculator: effective concurrency = `1 × N instances`

For high-scale deployments, extract workers into a separate process and scale them independently.

```
# Separate worker process (future extraction pattern)
node apps/api/dist/workers/standalone.js
```

### Worker Scaling

Analytics and Position workers are concurrency-1 for correctness. Do not run multiple instances of these workers without ensuring serialisation (e.g., via Redis-based distributed locking) — concurrent analytics upserts and concurrent position updates can produce incorrect results.

Webhook Dispatcher workers can scale freely (each delivery is independent).

### Database Read Replicas

All read-heavy operations (subscriber lists, analytics queries, leaderboard) can be routed to a read replica. Drizzle supports multiple connections — pass a replica URL for reads:

```typescript
// Future: create separate read client
const readDb = createDb(process.env.DATABASE_READ_URL ?? databaseUrl);
```

For the current implementation, all queries go through the single `DATABASE_URL`.

### Redis Clustering

BullMQ supports Redis Cluster. Use the ioredis `Cluster` client and pass it to BullMQ:

```typescript
import { Cluster } from "ioredis";
const cluster = new Cluster([{ host, port }], { ...options });
```

For most waitlist workloads, a single Redis instance is sufficient up to millions of subscribers.

---

## Health Checks

The API exposes a health endpoint:

```bash
curl http://localhost:3400/health
# → {"status":"ok"}
```

Use this for:
- **Docker Compose:** `healthcheck: test: ["CMD", "curl", "-f", "http://localhost:3400/health"]`
- **Kubernetes:** liveness and readiness probes
- **Load balancer health checks**

```yaml
# Kubernetes probe example
livenessProbe:
  httpGet:
    path: /health
    port: 3400
  initialDelaySeconds: 15
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health
    port: 3400
  initialDelaySeconds: 5
  periodSeconds: 5
```

The health endpoint returns `200 OK` immediately without checking database or Redis connectivity. For a deep health check, add a route that queries both.

---

## Monitoring and Logging

### Structured Logging

The API uses Fastify's built-in Pino logger. All logs are emitted as structured JSON (in production) or pretty-printed (in development via `pino-pretty`). Log level is controlled by `LOG_LEVEL`.

Example log line (JSON):
```json
{
  "level": 30,
  "time": 1711800000000,
  "pid": 1,
  "hostname": "api-pod-xyz",
  "reqId": "req-1",
  "req": { "method": "POST", "url": "/api/v1/subscribe" },
  "msg": "incoming request"
}
```

### Recommended Monitoring Stack

| Concern | Tool |
|---|---|
| Log aggregation | Loki + Grafana, or Datadog |
| Metrics | Prometheus + Grafana (add `fastify-metrics` plugin) |
| BullMQ queues | Bull Board UI, or custom Grafana dashboard via Redis metrics |
| Database | pg_stat_statements, pgBadger |
| Uptime | UptimeRobot / Checkly hitting `/health` |

### Key Metrics to Alert On

- API error rate (`5xx` responses) > 1%
- P95 response latency > 500ms on `/api/v1/subscribe`
- BullMQ failed jobs count increasing (webhook delivery failures)
- Redis memory usage > 80% of `maxmemory`
- PostgreSQL connection pool saturation

---

## Backup Strategy

### PostgreSQL

```bash
# Daily full backup
pg_dump -h localhost -p 5434 -U waitlist waitlist \
  -F custom -Z 9 \
  -f /backups/waitlist-$(date +%Y%m%d).dump

# Restore
pg_restore -h localhost -p 5434 -U waitlist -d waitlist \
  /backups/waitlist-20250330.dump
```

For production:
- Use managed PostgreSQL (AWS RDS, Supabase, Neon, Railway) with automated daily backups and point-in-time recovery (PITR).
- Retain 30 days of backups minimum.
- Test restores monthly.

### Redis

Redis data is mostly ephemeral (job queues and caches). If jobs are critical:
- Enable AOF persistence (`appendonly yes`) for near-zero data loss.
- Or accept that pending/delayed webhook jobs may be lost on Redis restart and let them time out.

Analytics cache (stats, leaderboard) can be safely lost — it will be repopulated from the database on the next request.

### Migrations

Drizzle migration files in `apps/api/drizzle/` are source-controlled. The migration state is tracked in a `drizzle_migrations` table in PostgreSQL. As long as the database backup is recent, migrations can be re-applied from any point.
