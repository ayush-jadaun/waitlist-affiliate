# Deploy to Railway

Railway is the fastest way to get the Waitlist API into production —
PostgreSQL, Redis, and the API service are all provisioned from one dashboard.

---

## Prerequisites

- [Railway account](https://railway.app) (free tier available)
- [Railway CLI](https://docs.railway.app/develop/cli) installed:
  ```bash
  npm install -g @railway/cli
  railway login
  ```

---

## Option A: Deploy from GitHub (recommended)

### 1. Push the repo to GitHub

If you haven't already:

```bash
git remote add origin https://github.com/your-org/waitlist-referral.git
git push -u origin main
```

### 2. Create a new Railway project

1. Go to [railway.app/new](https://railway.app/new)
2. Choose **"Deploy from GitHub repo"**
3. Select your `waitlist-referral` repository
4. Railway auto-detects the `Dockerfile` at the repo root

### 3. Add PostgreSQL

In your Railway project dashboard:

1. Click **"+ New"** → **"Database"** → **"PostgreSQL"**
2. Railway automatically sets the `DATABASE_URL` environment variable in your service

### 4. Add Redis

1. Click **"+ New"** → **"Database"** → **"Redis"**
2. Railway automatically sets the `REDIS_URL` environment variable

### 5. Set environment variables

In your service's **Variables** tab, add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3400` |
| `JWT_SECRET` | Run `openssl rand -base64 48` locally and paste |
| `ALLOWED_ORIGINS` | `https://your-frontend.vercel.app` |

Railway automatically injects `DATABASE_URL` and `REDIS_URL` from the linked databases.

### 6. Run database migrations

In the Railway dashboard, go to **Settings → Deploy → Start Command** and set:

```
pnpm db:migrate && node dist/index.js
```

Or add a **Release Command** (runs before the service starts):

```
pnpm db:migrate
```

### 7. Deploy

Railway deploys automatically on every push to `main`. Watch the build logs
in the **Deployments** tab.

After the deploy completes:

```bash
# Get your Railway URL
railway status

# Test health
curl https://your-service.railway.app/health
# { "status": "ok", "db": "ok", "redis": "ok" }
```

---

## Option B: Deploy via CLI

```bash
# Link to your Railway project
railway link

# Set environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3400
railway variables set JWT_SECRET=$(openssl rand -base64 48)
railway variables set ALLOWED_ORIGINS=https://your-frontend.vercel.app

# Provision PostgreSQL and Redis (adds DATABASE_URL and REDIS_URL automatically)
railway add --plugin postgresql
railway add --plugin redis

# Deploy
railway up

# Run migrations
railway run pnpm db:migrate
```

---

## Custom domain

1. In the Railway dashboard → your service → **Settings** → **Domains**
2. Click **"Generate Domain"** for a free `*.railway.app` subdomain, or
3. Click **"Custom Domain"** and follow the DNS instructions for your domain

Railway provisions a free TLS certificate automatically.

---

## Environment variables reference

```bash
# Required
DATABASE_URL   # Set automatically by Railway PostgreSQL plugin
REDIS_URL      # Set automatically by Railway Redis plugin
JWT_SECRET     # Generate: openssl rand -base64 48
PORT           # 3400

# Optional
NODE_ENV           # production
ALLOWED_ORIGINS    # https://myapp.com,https://www.myapp.com
HOST               # 0.0.0.0
```

---

## Continuous deployment

Railway redeploys automatically when you push to the branch linked in your
service settings (default: `main`).

To change the branch:
**Settings** → **Source** → **Branch**

To disable auto-deploy and trigger manually:
**Settings** → **Source** → uncheck "Auto Deploy"

```bash
# Trigger a manual deploy from the CLI
railway up --detach
```

---

## Monitoring

Railway provides built-in metrics (CPU, RAM, network) in the **Metrics** tab.

For external uptime monitoring, add the health endpoint to UptimeRobot or BetterUptime:

```
https://your-service.railway.app/health
```

---

## Scaling

Railway automatically scales vertically. To adjust:

**Settings** → **Resources** → drag the CPU / RAM sliders.

For horizontal scaling (multiple replicas), upgrade to the Railway Pro plan
and enable **Replicas** in the service settings.
