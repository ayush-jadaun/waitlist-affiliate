# Waitlist & Viral Referral System — Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Project:** `waitlist-referral/`

---

## Overview

An embeddable library + lightweight Node.js backend for waitlist management and viral referral tracking. Supports three configurable modes (pre-launch, gated access, viral growth) with tier-based rewards, position bumping, full analytics, webhook event dispatch, and an admin dashboard.

**Target audience:** The developer (for client projects) AND other developers (published npm packages + Docker service).

---

## Architecture

Single Node.js API server + BullMQ background workers, backed by PostgreSQL and Redis.

```
┌─────────────────────────────────────────────────┐
│                  npm packages                    │
│  @waitlist/sdk    @waitlist/widget   @waitlist/react │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────┐
│              API Server (Node.js)                │
│  ┌──────────┬──────────┬─────────┬───────────┐  │
│  │ Waitlist │ Referral │ Rewards │   Admin   │  │
│  └──────────┴──────────┴─────────┴───────────┘  │
│  ┌──────────────────────────────────────────┐   │
│  │              Webhooks                     │   │
│  └──────────────────────────────────────────┘   │
└────────┬──────────────────┬─────────────────────┘
         │                  │
    ┌────▼────┐       ┌────▼────┐
    │PostgreSQL│       │  Redis  │
    └─────────┘       └────┬────┘
                           │ BullMQ
              ┌────────────▼────────────┐
              │    Background Workers    │
              │  • Analytics Aggregator  │
              │  • Webhook Dispatcher    │
              │  • Position Recalculator │
              └─────────────────────────┘

┌─────────────────────────────────────────────────┐
│         Admin Dashboard (React SPA)              │
│  Served at /admin from API server                │
└─────────────────────────────────────────────────┘
```

### Components

- **3 npm packages:** `@waitlist/sdk` (headless JS client), `@waitlist/widget` (drop-in `<script>` tag), `@waitlist/react` (React components). All communicate with the API via REST.
- **API server:** Single Node.js service (Fastify) handling signups, referral tracking, rewards, admin endpoints, webhook registration.
- **BullMQ workers:** Run in the same process or separately. Handle analytics aggregation, webhook delivery with retry, and batch position recalculation.
- **PostgreSQL:** All persistent data — subscribers, referral chains, reward tiers, events, analytics aggregations.
- **Redis:** BullMQ queues, rate limiting, cached leaderboards/positions.
- **Admin Dashboard:** React SPA for managing waitlists, viewing analytics, configuring rewards and webhooks. Served as static build from the API at `/admin`.

### Stack

- Node.js + Fastify
- PostgreSQL + Drizzle ORM
- Redis + BullMQ
- React + Tailwind + Recharts + TanStack Table (admin dashboard)
- TypeScript throughout

---

## Data Model

### Core Tables

| Table | Purpose |
|-------|---------|
| `projects` | Each waitlist project (mode, config, API keys) |
| `subscribers` | Email, referral code, position (nullable — unused in gated mode), status, metadata |
| `referrals` | Who referred whom — `referrer_id → referred_id` |
| `reward_tiers` | Per-project tier config — name, threshold, reward type, reward value |
| `reward_unlocks` | Which subscriber unlocked which tier, when |
| `events` | Raw event log — signup, referral, tier_unlock, approval, etc. |
| `analytics_daily` | Pre-aggregated daily stats — signups, referrals, K-factor, conversion rate |
| `analytics_cohorts` | Weekly cohort data for retention/virality analysis |
| `experiments` | A/B test definitions — name, variants, traffic split |
| `experiment_assignments` | Which subscriber is in which variant |
| `webhook_endpoints` | Registered webhook URLs + secret + event filters |
| `webhook_deliveries` | Delivery log — payload, status, retries, response |

### Key Relationships

- A `project` has many `subscribers`, `reward_tiers`, `experiments`, `webhook_endpoints`.
- A `subscriber` has one unique `referral_code`, belongs to one `project`, optionally has a `referred_by` subscriber.
- `referrals` form a directed tree per project — enables chain visualization.
- `events` is append-only. BullMQ workers consume it to build aggregation tables.

---

## Waitlist Modes

Each project is created with a `mode` and a config object.

### Pre-launch Mode

- Subscribers get a position number on signup.
- Referrals bump the referrer up (configurable: -N positions per referral, or percentage-based).
- Optional: cap the waitlist size.
- Optional: auto-approve first N subscribers.
- Status flow: `waiting → approved`

### Gated Access Mode

- No position numbers — subscribers are in a queue.
- Admin reviews and approves/rejects in batches or individually.
- Optional: auto-approve if referred by N people.
- Status flow: `pending → approved/rejected`

### Viral Growth Mode

- Position exists but referral leaderboard is the focus.
- Referral count is prominently displayed.
- Leaderboard ranks by referral count, not signup order.
- Gamification: progress bars toward next tier, share prompts after signup.
- Status flow: `active` (everyone is "in", rewards are the incentive).

### Shared Config

```typescript
interface ProjectConfig {
  mode: 'prelaunch' | 'gated' | 'viral'
  name: string
  maxSubscribers?: number
  requireEmailVerification: boolean
  customFields?: FieldDefinition[]
  referral: {
    enabled: boolean
    positionBump: number       // positions to jump per referral
    maxBumps?: number          // cap on position gains
  }
  rewards: RewardTier[]
  deduplication: 'email' | 'email+ip'
  rateLimit: { window: string; max: number }
}
```

---

## Referral & Rewards Engine

### Referral Flow

1. Subscriber signs up → gets a unique referral code (short, URL-safe, e.g. `abc12x`).
2. Subscriber shares their link: `https://yoursite.com?ref=abc12x`
3. New person signs up via that link → `referrals` table records the relationship.
4. System checks referrer's total count against reward tiers → unlocks if threshold met.
5. If position bumping is enabled, referrer's position is recalculated.
6. Webhook events fired: `referral.created`, `reward.unlocked`, `position.changed`.

### Referral Chain Tracking

- Each subscriber has a `referred_by` field — creates a tree.
- Chain stored for analytics (depth tracking, viral spread visualization).
- Fraud guards: self-referral blocked, same-IP detection, email domain throttling.

### Reward Tiers

Configurable per project. Example:

```
Tier 1: 3 referrals  → "early_access"   (flag on subscriber)
Tier 2: 5 referrals  → "discount_code"  (value: "SAVE20")
Tier 3: 10 referrals → "premium_access" (flag + custom metadata)
Tier 4: 25 referrals → "vip"            (custom reward)
```

Each tier has:
- `threshold` — number of verified referrals needed.
- `rewardType` — `flag | code | custom`
- `rewardValue` — the actual value (code string, JSON metadata, etc.)
- `webhookEvent` — fires when unlocked, so the developer's system can fulfill the reward.

### Position Bumping

- Configurable: `-N positions per referral` (default: -1).
- Cap: `maxBumps` prevents gaming to position #1 with many referrals.
- Recalculation happens in BullMQ worker to avoid race conditions.

### Fraud Prevention

- Email verification required (configurable).
- Same-IP detection within time window.
- Disposable email domain blocklist.
- Rate limiting on signup endpoint.
- Referral only counts after email verification (if enabled).

---

## Analytics & A/B Testing

### Real-time Metrics (Redis-cached, refreshed by worker)

- Total signups, today's signups
- Total referrals, today's referrals
- Conversion rate (visitors with ref link → actual signups)
- Current K-factor (avg referrals per subscriber that convert)

### Time-series (aggregated daily into `analytics_daily`)

- Signups over time
- Referrals over time
- K-factor trend
- Reward unlock rate per tier
- Position distribution

### Cohort Analysis (`analytics_cohorts`)

- Weekly signup cohorts
- Per-cohort: how many referred someone within 1d, 7d, 30d
- Referral depth per cohort (1st-gen, 2nd-gen, 3rd-gen referrals)
- Retention: do early referrers keep referring?

### Share Channel Breakdown

- SDK tracks `utm_source` / `channel` param on referral links.
- Pre-built channels: `twitter`, `facebook`, `linkedin`, `whatsapp`, `email`, `copy` (clipboard).
- Dashboard shows which channels drive the most conversions.

### Top Referrers Leaderboard

- Ranked by verified referral count.
- Filterable by time period.
- Exportable (CSV/JSON).

### A/B Testing

- Create experiments: e.g. "Does offering a discount code at Tier 1 vs early access drive more referrals?"
- Traffic split: percentage-based assignment on signup.
- Each subscriber assigned to one variant, stored in `experiment_assignments`.
- Dashboard shows per-variant metrics: referral rate, K-factor, tier unlock rate.
- No auto-winner detection — admin reviews and picks the winner manually.

### Aggregation Pipeline

1. Every signup/referral/unlock writes a raw event to `events` table.
2. BullMQ `analytics-aggregator` job runs on schedule (every 5 min for real-time, daily for cohorts).
3. Worker reads new events, updates `analytics_daily` and `analytics_cohorts` via upsert.
4. Redis caches the hot metrics (leaderboard, today's stats) with TTL.

---

## API Design

### Public API (API key auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/subscribe` | Join waitlist (email, name, ref code, custom fields) |
| `GET` | `/api/v1/subscribe/:email/status` | Check position, referral count, unlocked rewards |
| `GET` | `/api/v1/leaderboard` | Top referrers (public, configurable) |
| `GET` | `/api/v1/stats` | Public stats (total signups, spots remaining) |

### Admin API (JWT auth)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET/PUT` | `/api/v1/admin/project` | Project config (mode, rewards, settings) |
| `GET` | `/api/v1/admin/subscribers` | List, filter, search, paginate |
| `PATCH` | `/api/v1/admin/subscribers/:id` | Approve, reject, ban |
| `POST` | `/api/v1/admin/subscribers/bulk` | Bulk approve/reject |
| `GET` | `/api/v1/admin/analytics/overview` | Real-time dashboard metrics |
| `GET` | `/api/v1/admin/analytics/timeseries` | Time-series data with date range |
| `GET` | `/api/v1/admin/analytics/cohorts` | Cohort analysis |
| `GET` | `/api/v1/admin/analytics/channels` | Share channel breakdown |
| `CRUD` | `/api/v1/admin/rewards` | Manage reward tiers |
| `CRUD` | `/api/v1/admin/experiments` | Manage A/B tests |
| `CRUD` | `/api/v1/admin/webhooks` | Manage webhook endpoints |
| `GET` | `/api/v1/admin/webhooks/:id/deliveries` | Delivery log |

---

## SDK & Widget

### Headless SDK (`@waitlist/sdk`)

```typescript
import { WaitlistClient } from '@waitlist/sdk'

const client = new WaitlistClient({
  apiKey: 'wl_pk_...',
  baseUrl: 'https://your-api.com'
})

// Subscribe
const result = await client.subscribe({
  email: 'user@example.com',
  name: 'Jane',
  referralCode: 'abc12x',
  metadata: { plan: 'pro' }
})
// → { position: 142, referralCode: 'xyz89k', totalSignups: 5000 }

// Check status
const status = await client.getStatus('user@example.com')
// → { position: 89, referralCount: 3, rewards: ['early_access'], status: 'waiting' }
```

### Drop-in Widget (`@waitlist/widget`)

```html
<script
  src="https://unpkg.com/@waitlist/widget"
  data-api-key="wl_pk_..."
  data-api-url="https://your-api.com"
  data-theme="dark"
  data-accent="#4a9eff">
</script>
```

### React Components (`@waitlist/react`)

```tsx
import { WaitlistForm, ReferralStatus } from '@waitlist/react'

<WaitlistForm apiKey="wl_pk_..." onSuccess={(sub) => console.log(sub)} />
<ReferralStatus email={user.email} apiKey="wl_pk_..." />
```

---

## Webhook Events

| Event | Fires when |
|-------|-----------|
| `subscriber.created` | New signup (includes position, referral source) |
| `subscriber.verified` | Email verified |
| `subscriber.approved` | Admin approves (gated mode) |
| `subscriber.rejected` | Admin rejects |
| `referral.created` | A referred signup is verified |
| `reward.unlocked` | Subscriber hits a reward tier |
| `position.changed` | Subscriber's position changes (bump) |
| `experiment.assigned` | Subscriber assigned to A/B variant |
| `waitlist.milestone` | Configurable: e.g. "hit 1000 signups" |

### Webhook Delivery

- Signed with HMAC-SHA256 (shared secret per endpoint).
- Retry with exponential backoff: 1m, 5m, 30m, 2h, 12h (5 attempts).
- Delivery log with payload, response code, timing.
- Manual retry from admin dashboard.

---

## Admin Dashboard

React SPA served at `/admin` from the API server.

| Page | Content |
|------|---------|
| Overview | Real-time stats cards, signup/referral charts, K-factor |
| Subscribers | Searchable table, status filters, bulk actions, export CSV |
| Referral Tree | Visual graph of referral chains (top referrers expanded) |
| Leaderboard | Ranked referrers, filterable by period |
| Rewards | Configure tiers, see unlock rates per tier |
| Experiments | Create/view A/B tests, per-variant metrics |
| Channels | Share channel breakdown, conversion by source |
| Cohorts | Weekly cohort grid with referral activity |
| Webhooks | Manage endpoints, view delivery log, test/replay |
| Settings | Project config, API keys, mode, rate limits |

**Dashboard stack:** React + Tailwind + Recharts + TanStack Table. JWT auth — admin creates account on first setup.

---

## Project Structure

```
waitlist-referral/
├── packages/
│   ├── sdk/                  # @waitlist/sdk — headless JS client
│   ├── widget/               # @waitlist/widget — drop-in <script> embed
│   └── react/                # @waitlist/react — React components
├── apps/
│   ├── api/                  # Fastify API server + BullMQ workers
│   └── admin/                # React admin dashboard
├── packages/shared/          # Shared types, validation schemas, constants
├── docker-compose.yml        # PostgreSQL + Redis + API + Admin
├── drizzle/                  # Database migrations
├── docs/
│   └── superpowers/specs/    # This spec
├── .env.example
├── turbo.json                # Turborepo config (monorepo)
├── package.json
└── README.md
```

**Monorepo managed with Turborepo.** Shared types between SDK, API, and admin dashboard.

---

## Non-Functional Requirements

- **Rate limiting:** Per-API-key, per-IP on public endpoints (Redis-backed).
- **Security:** HMAC-signed webhooks, API key hashing, input validation (Zod), CORS configuration.
- **Performance:** Leaderboard and stats cached in Redis with TTL. Analytics aggregated in background, not computed on request.
- **Testing:** Unit tests for referral logic and position calculation. Integration tests for API endpoints. E2E for widget embed.
- **Deployment:** Docker Compose for local dev and self-hosted. Documented Vercel/Railway deployment for the admin SPA.
- **Documentation:** OpenAPI spec for all endpoints. README with architecture diagram. SDK usage examples.
