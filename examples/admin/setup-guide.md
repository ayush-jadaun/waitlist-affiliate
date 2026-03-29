# Admin Setup Guide

Step-by-step guide to getting a waitlist project running from zero.

## Prerequisites

- API server running (`cd apps/api && pnpm dev` — listens on `:3400`)
- `curl` and `jq` installed
- A database and Redis running (see `docker-compose.yml` at the repo root)

---

## Step 1: Start the API server

```bash
# From the repo root
docker compose up -d postgres redis

cd apps/api
pnpm dev
```

Verify it is healthy:

```bash
curl http://localhost:3400/health
# {"status":"ok","db":"ok","redis":"ok"}
```

---

## Step 2: Create the first admin account

This endpoint only works once — when no admin users exist yet.

```bash
curl -s -X POST http://localhost:3400/api/v1/admin/auth/setup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "supersecret123"
  }' | jq .
```

Expected response (`201 Created`):

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Save the token:

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

> If you get `409 Admin already exists`, log in instead (Step 2b).

### Step 2b: Log in (if admin already exists)

```bash
TOKEN=$(curl -s -X POST http://localhost:3400/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "supersecret123"
  }' | jq -r '.token')

echo "Token: ${TOKEN:0:40}..."
```

---

## Step 3: Create a waitlist project

Choose one of three modes based on your use case:

### Mode: `prelaunch` — public waitlist with visible positions

Best for: SaaS launches, newsletters, apps where social proof matters.

```bash
curl -s -X POST http://localhost:3400/api/v1/admin/project \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "My SaaS Launch",
    "mode": "prelaunch",
    "requireEmailVerification": false,
    "deduplication": "email",
    "rateLimit": { "window": "1m", "max": 10 },
    "referral": {
      "enabled": true,
      "positionBump": 5,
      "maxBumps": 50
    },
    "rewards": []
  }' | jq .
```

### Mode: `gated` — invite-only; admin approves each subscriber

Best for: closed betas, enterprise trials, exclusive communities.

```bash
curl -s -X POST http://localhost:3400/api/v1/admin/project \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Closed Beta",
    "mode": "gated",
    "maxSubscribers": 200,
    "requireEmailVerification": true,
    "deduplication": "email+ip",
    "rateLimit": { "window": "1m", "max": 5 },
    "referral": {
      "enabled": true,
      "positionBump": 10
    },
    "rewards": []
  }' | jq .
```

### Mode: `viral` — referral-first; positions not shown publicly

Best for: consumer apps, games, viral growth campaigns.

```bash
curl -s -X POST http://localhost:3400/api/v1/admin/project \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Viral Campaign",
    "mode": "viral",
    "requireEmailVerification": false,
    "deduplication": "email",
    "rateLimit": { "window": "1m", "max": 20 },
    "referral": {
      "enabled": true,
      "positionBump": 3
    },
    "rewards": []
  }' | jq .
```

**Save the API key from the response:**

```bash
PROJECT_ID="<id from response>"
API_KEY="wl_pk_<key from response>"
```

> The API key is only shown once in the create response.
> Store it safely — it cannot be retrieved again (only regenerated).

---

## Step 4: Get the API key

The API key is returned in the `POST /api/v1/admin/project` response as `apiKey`.
It follows the format `wl_pk_<random>`.

Use it as the `X-API-Key` header for all public endpoints (`/api/v1/subscribe`,
`/api/v1/stats`, `/api/v1/leaderboard`).

Verify it works:

```bash
curl -s http://localhost:3400/api/v1/stats \
  -H "X-API-Key: $API_KEY" | jq .
# { "totalSignups": 0, "spotsRemaining": null, "referralsMade": 0 }
```

---

## Step 5: Configure reward tiers

Reward tiers unlock automatically when a subscriber reaches the referral threshold.

```bash
# Tier 1 — unlock a feature flag after 1 referral
curl -s -X POST http://localhost:3400/api/v1/admin/rewards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"name\": \"Early Bird\",
    \"threshold\": 1,
    \"rewardType\": \"flag\",
    \"rewardValue\": \"early_bird_feature\",
    \"sortOrder\": 0
  }" | jq .

# Tier 2 — send a coupon code after 5 referrals
curl -s -X POST http://localhost:3400/api/v1/admin/rewards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"name\": \"Referral Pro\",
    \"threshold\": 5,
    \"rewardType\": \"code\",
    \"rewardValue\": \"BETA50\",
    \"sortOrder\": 1
  }" | jq .

# Tier 3 — custom reward after 10 referrals
curl -s -X POST http://localhost:3400/api/v1/admin/rewards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"name\": \"VIP Access\",
    \"threshold\": 10,
    \"rewardType\": \"custom\",
    \"rewardValue\": \"lifetime_deal\",
    \"sortOrder\": 2
  }" | jq .
```

Reward types:
| `rewardType` | `rewardValue` | When to use |
|---|---|---|
| `flag`   | Feature flag name | Toggle a feature in your app per user |
| `code`   | Coupon / discount code | Email a code to the subscriber |
| `custom` | Anything you define | Store arbitrary data; handle in your webhook |

---

## Step 6: Register webhooks

Webhooks fire on key events. Register an endpoint to trigger actions in your app
(send emails, update your CRM, provision access, etc.).

```bash
curl -s -X POST http://localhost:3400/api/v1/admin/webhooks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"projectId\": \"$PROJECT_ID\",
    \"url\": \"https://your-app.vercel.app/api/webhook\",
    \"secret\": \"whsec_my-signing-secret-change-me\",
    \"events\": [
      \"subscriber.created\",
      \"subscriber.approved\",
      \"subscriber.rejected\",
      \"referral.created\",
      \"reward.unlocked\"
    ]
  }" | jq .
```

For local testing use [webhook.site](https://webhook.site) or
[ngrok](https://ngrok.com) to get a public URL:

```bash
ngrok http 4000
# Then use the https://xxxx.ngrok.io/webhooks URL above
```

See `examples/api/webhook-receiver.ts` (Node/Express) and
`examples/api/webhook-receiver-python.py` (Flask) for complete receiver examples.

### Verify delivery history

```bash
WEBHOOK_ID="<id from create response>"

curl -s "http://localhost:3400/api/v1/admin/webhooks/$WEBHOOK_ID/deliveries?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Step 7: Monitor analytics

### Overview (live KPIs)

```bash
curl -s "http://localhost:3400/api/v1/admin/analytics/overview?projectId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

```json
{
  "totalSignups": 1247,
  "todaySignups": 38,
  "totalReferrals": 412,
  "todayReferrals": 14,
  "conversionRate": 0.3303,
  "kFactor": 0.3303
}
```

### Timeseries (last 30 days)

```bash
FROM=$(date -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)
TO=$(date +%Y-%m-%d)

curl -s "http://localhost:3400/api/v1/admin/analytics/timeseries?projectId=$PROJECT_ID&from=$FROM&to=$TO" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Cohort analysis (referral depth)

```bash
curl -s "http://localhost:3400/api/v1/admin/analytics/cohorts?projectId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

### Channel attribution

```bash
curl -s "http://localhost:3400/api/v1/admin/analytics/channels?projectId=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" | jq .
```

---

## Quick reference

| What | Endpoint | Auth |
|---|---|---|
| First admin setup | `POST /api/v1/admin/auth/setup` | None |
| Admin login | `POST /api/v1/admin/auth/login` | None |
| Create project | `POST /api/v1/admin/project` | JWT |
| List projects | `GET /api/v1/admin/project` | JWT |
| Update project | `PUT /api/v1/admin/project/:id` | JWT |
| Subscribe user | `POST /api/v1/subscribe` | API Key |
| Get status | `GET /api/v1/subscribe/:email/status` | API Key |
| Leaderboard | `GET /api/v1/leaderboard` | API Key |
| Public stats | `GET /api/v1/stats` | API Key |
| List subscribers | `GET /api/v1/admin/subscribers` | JWT |
| Approve/reject | `PATCH /api/v1/admin/subscribers/:id` | JWT |
| Bulk action | `POST /api/v1/admin/subscribers/bulk` | JWT |
| Create reward | `POST /api/v1/admin/rewards` | JWT |
| Register webhook | `POST /api/v1/admin/webhooks` | JWT |
| Create experiment | `POST /api/v1/admin/experiments` | JWT |
| Analytics overview | `GET /api/v1/admin/analytics/overview` | JWT |
| Analytics timeseries | `GET /api/v1/admin/analytics/timeseries` | JWT |
| Cohort analysis | `GET /api/v1/admin/analytics/cohorts` | JWT |
| Channel stats | `GET /api/v1/admin/analytics/channels` | JWT |
