# Production Deployment with Docker

This guide covers deploying the Waitlist & Viral Referral System to a production
Linux server using Docker Compose, with Nginx as a TLS-terminating reverse proxy.

---

## Environment variables checklist

Create `/etc/waitlist/.env` on your server (never commit this file):

```bash
# ── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://waitlist:CHANGE_ME_DB_PASS@postgres:5432/waitlist

# ── Redis ───────────────────────────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ── JWT ─────────────────────────────────────────────────────────────────────
# Generate with: openssl rand -base64 48
JWT_SECRET=CHANGE_ME_JWT_SECRET_AT_LEAST_32_CHARS

# ── Server ──────────────────────────────────────────────────────────────────
PORT=3400
NODE_ENV=production
HOST=0.0.0.0

# ── CORS ────────────────────────────────────────────────────────────────────
# Comma-separated list of allowed origins (your frontend domains)
ALLOWED_ORIGINS=https://myapp.com,https://www.myapp.com

# ── (Optional) Admin dashboard ──────────────────────────────────────────────
# Only needed if you deploy the admin dashboard separately
# ADMIN_URL=https://admin.myapp.com
```

Generate a strong JWT secret:

```bash
openssl rand -base64 48
```

---

## Docker Compose production configuration

Save as `docker-compose.prod.yml`:

```yaml
version: "3.9"

services:
  # ── API ─────────────────────────────────────────────────────────────────
  api:
    image: ghcr.io/your-org/waitlist-api:latest  # or build locally
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "127.0.0.1:3400:3400"   # bind to localhost only — Nginx proxies externally
    env_file:
      - /etc/waitlist/.env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3400/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s

  # ── PostgreSQL ───────────────────────────────────────────────────────────
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: waitlist
      POSTGRES_USER: waitlist
      POSTGRES_PASSWORD: CHANGE_ME_DB_PASS   # match DATABASE_URL above
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U waitlist"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Redis ────────────────────────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

---

## Database migration

Run migrations before starting the API for the first time (or after updates):

```bash
# On the server
docker compose -f docker-compose.prod.yml run --rm api pnpm db:migrate

# Or exec into a running container
docker compose -f docker-compose.prod.yml exec api pnpm db:migrate
```

---

## Health check verification

After starting the stack, verify all services are healthy:

```bash
docker compose -f docker-compose.prod.yml ps

# All services should show "healthy" or "running"
# NAME          STATUS          PORTS
# api           Up (healthy)    127.0.0.1:3400->3400/tcp
# postgres      Up (healthy)
# redis         Up (healthy)

# Verify the API health endpoint
curl -s http://localhost:3400/health | jq .
# { "status": "ok", "db": "ok", "redis": "ok" }
```

---

## SSL / Reverse proxy (Nginx)

### Install Nginx and Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Nginx site configuration

Save as `/etc/nginx/sites-available/waitlist`:

```nginx
# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name api.myapp.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.myapp.com;

    # SSL certificates (managed by Certbot)
    ssl_certificate     /etc/letsencrypt/live/api.myapp.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.myapp.com/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options           DENY;
    add_header X-Content-Type-Options    nosniff;
    add_header X-XSS-Protection          "1; mode=block";
    add_header Referrer-Policy           "strict-origin-when-cross-origin";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Proxy to API container
    location / {
        proxy_pass         http://127.0.0.1:3400;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade         $http_upgrade;
        proxy_set_header   Connection      keep-alive;
        proxy_set_header   Host            $host;
        proxy_set_header   X-Real-IP       $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;

        # Timeouts
        proxy_connect_timeout  10s;
        proxy_send_timeout     30s;
        proxy_read_timeout     30s;

        # Buffer settings
        proxy_buffering    on;
        proxy_buffer_size  4k;
        proxy_buffers      8 4k;
    }

    # Rate limit subscribe endpoint at the Nginx level too
    limit_req_zone $binary_remote_addr zone=subscribe:10m rate=5r/m;
    location /api/v1/subscribe {
        limit_req zone=subscribe burst=10 nodelay;
        proxy_pass http://127.0.0.1:3400;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

Enable and test:

```bash
sudo ln -s /etc/nginx/sites-available/waitlist /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Obtain TLS certificate

```bash
sudo certbot --nginx -d api.myapp.com
# Follow the prompts — Certbot will auto-update the Nginx config
```

Auto-renew is configured automatically. Test renewal:

```bash
sudo certbot renew --dry-run
```

---

## Start the stack

```bash
docker compose -f docker-compose.prod.yml up -d

# Follow logs
docker compose -f docker-compose.prod.yml logs -f api
```

---

## Monitoring setup

### Option A: Built-in health endpoint polling (minimal)

Add a simple cron on the server:

```bash
# /etc/cron.d/waitlist-health
*/5 * * * * root curl -sf http://localhost:3400/health || mail -s "Waitlist API DOWN" ops@myapp.com
```

### Option B: UptimeRobot (free tier)

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Add monitor → HTTPS → `https://api.myapp.com/health`
3. Set interval: 5 minutes
4. Add alert contacts (email, Slack, PagerDuty)

### Option C: Prometheus + Grafana (full observability)

Add to `docker-compose.prod.yml`:

```yaml
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "127.0.0.1:9090:9090"

  grafana:
    image: grafana/grafana:latest
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "127.0.0.1:3001:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: CHANGE_ME_GRAFANA_PASS
```

`prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: waitlist-api
    static_configs:
      - targets: ['api:3400']
    metrics_path: /metrics
```

---

## Backups

Daily PostgreSQL backup to S3:

```bash
# /etc/cron.d/waitlist-backup
0 3 * * * root docker exec waitlist-postgres-1 \
  pg_dump -U waitlist waitlist | gzip \
  | aws s3 cp - s3://my-backups/waitlist/$(date +\%Y-\%m-\%d).sql.gz
```

---

## Updating

```bash
# Pull new images
docker compose -f docker-compose.prod.yml pull

# Run migrations first
docker compose -f docker-compose.prod.yml run --rm api pnpm db:migrate

# Restart with zero downtime (rolling update)
docker compose -f docker-compose.prod.yml up -d --no-deps --remove-orphans api
```
