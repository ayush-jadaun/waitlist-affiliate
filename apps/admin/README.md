# @waitlist/admin

React admin dashboard for managing waitlist projects, subscribers, rewards, experiments, webhooks, and analytics.

## Tech Stack

- **React 19** — UI framework
- **Tailwind CSS 4** — utility-first styling
- **Recharts 2** — charts on the Overview page
- **TanStack Query 5** — server state management
- **Vite 6** — dev server and build tool

## Getting Started

### 1. Set the API URL

```bash
# .env.local
VITE_API_URL=http://localhost:3400
```

If `VITE_API_URL` is not set, it defaults to `http://localhost:3400`.

### 2. Start the dev server

```bash
pnpm --filter @waitlist/admin dev
```

The dashboard is available at `http://localhost:5173`.

### First-time setup

On first load you will be prompted to sign in. If no admin account exists yet, use the **"First time? Set up admin account"** link to create one. After that, go to **Settings** to create your first waitlist project.

## Pages

| Page            | Route (client-side) | Description                                                         |
|-----------------|---------------------|---------------------------------------------------------------------|
| **Overview**    | `overview`          | Key metrics (total signups, referrals, k-factor), timeseries chart, cohort table, channel breakdown |
| **Subscribers** | `subscribers`       | Paginated subscriber list with search, status filter, inline status update, and bulk approve/reject/ban |
| **Rewards**     | `rewards`           | Manage referral reward tiers (name, referral threshold, reward type and value) |
| **Experiments** | `experiments`       | Create and toggle A/B experiments with weighted variants            |
| **Webhooks**    | `webhooks`          | Register outbound webhook endpoints, select events, view delivery history |
| **Settings**    | `settings`          | Create and update waitlist project configuration (mode, referral settings, rate limits, etc.) |

## Environment Variables

| Variable        | Required | Default                  | Description                              |
|-----------------|----------|--------------------------|------------------------------------------|
| `VITE_API_URL`  | No       | `http://localhost:3400`  | Base URL of the `@waitlist/api` server   |

## Build for Production

```bash
pnpm --filter @waitlist/admin build
```

Output is written to `apps/admin/dist/`. Serve it with any static file host or a reverse proxy that forwards `/api/*` to the API server.
