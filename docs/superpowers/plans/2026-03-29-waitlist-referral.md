# Waitlist & Viral Referral System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an embeddable waitlist + viral referral system with a headless SDK, drop-in widget, React components, Fastify API, BullMQ workers, and React admin dashboard.

**Architecture:** Turborepo monorepo with 3 npm packages (`@waitlist/sdk`, `@waitlist/widget`, `@waitlist/react`), a Fastify API server with BullMQ background workers, and a React admin dashboard. PostgreSQL for persistence, Redis for queues/caching.

**Tech Stack:** Node.js 20+, TypeScript (ES2022/NodeNext), Fastify 5, Drizzle ORM, PostgreSQL 16, Redis 7, BullMQ, Vitest, pnpm, Turborepo, React 19, Tailwind CSS 4, Recharts, TanStack Table/Router/Query

**Spec:** `docs/superpowers/specs/2026-03-29-waitlist-referral-design.md`

---

## Phase 1: Foundation

### Task 1: Monorepo Scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `docker-compose.yml`
- Create: `.gitignore`
- Create: `eslint.config.mjs`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Initialize git and create root package.json**

```bash
cd "E:/Web dev/projects/waitlist-referral"
git init
```

```json
// package.json
{
  "name": "waitlist-referral",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.4",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "test": "turbo run test",
    "test:unit": "turbo run test:unit",
    "test:integration": "turbo run test:integration",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean",
    "db:generate": "turbo run db:generate --filter=@waitlist/api",
    "db:migrate": "turbo run db:migrate --filter=@waitlist/api",
    "db:studio": "turbo run db:studio --filter=@waitlist/api"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 3: Create turbo.json**

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "test:unit": {},
    "test:integration": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    },
    "db:studio": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 4: Create tsconfig.base.json**

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 5: Create .env.example**

```bash
# .env.example

# Database
DATABASE_URL=postgres://waitlist:waitlist@localhost:5434/waitlist

# Redis
REDIS_URL=redis://localhost:6381

# Server
PORT=3400
HOST=0.0.0.0
LOG_LEVEL=debug

# Admin Auth
ADMIN_JWT_SECRET=change-me-in-production-min-32-chars
ADMIN_SETUP_EMAIL=admin@example.com
ADMIN_SETUP_PASSWORD=change-me-in-production

# CORS (comma-separated origins)
CORS_ORIGINS=http://localhost:3400,http://localhost:5173
```

- [ ] **Step 6: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    ports:
      - "5434:5432"
    environment:
      POSTGRES_USER: waitlist
      POSTGRES_PASSWORD: waitlist
      POSTGRES_DB: waitlist
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U waitlist"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6381:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

- [ ] **Step 7: Create .gitignore**

```
# .gitignore
node_modules/
dist/
.env
.env.local
*.log
.turbo/
.superpowers/
coverage/
.DS_Store
```

- [ ] **Step 8: Create eslint.config.mjs**

```javascript
// eslint.config.mjs
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/.next/**"],
  }
);
```

- [ ] **Step 9: Create packages/shared skeleton**

```json
// packages/shared/package.json
{
  "name": "@waitlist/shared",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

```json
// packages/shared/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts"]
}
```

```typescript
// packages/shared/src/index.ts
export {};
```

- [ ] **Step 10: Create apps/api skeleton**

```json
// apps/api/package.json
{
  "name": "@waitlist/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/server.ts",
    "start": "node dist/server.js",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@waitlist/shared": "workspace:*",
    "fastify": "^5.0.0",
    "@fastify/cors": "^11.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@fastify/static": "^8.0.0",
    "@fastify/jwt": "^9.0.0",
    "drizzle-orm": "^0.39.0",
    "postgres": "^3.4.0",
    "ioredis": "^5.4.0",
    "bullmq": "^5.0.0",
    "zod": "^3.23.0",
    "nanoid": "^5.0.0",
    "pino": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0",
    "drizzle-kit": "^0.30.0",
    "@types/node": "^22.0.0"
  }
}
```

```json
// apps/api/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"],
  "exclude": ["src/**/__tests__/**", "**/*.test.ts"]
}
```

```typescript
// apps/api/src/index.ts
export {};
```

- [ ] **Step 11: Install dependencies and verify build**

Run: `pnpm install && pnpm build`
Expected: Clean install and successful build of both packages

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: scaffold monorepo with shared package and api app"
```

---

### Task 2: Shared Types & Validation Schemas

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/schemas.ts`
- Create: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/package.json` (add zod dependency)

- [ ] **Step 1: Add zod dependency to shared**

Add `"zod": "^3.23.0"` to `dependencies` in `packages/shared/package.json`.

Run: `pnpm install`

- [ ] **Step 2: Create types.ts**

```typescript
// packages/shared/src/types.ts

export type WaitlistMode = "prelaunch" | "gated" | "viral";
export type SubscriberStatus =
  | "waiting"
  | "pending"
  | "approved"
  | "rejected"
  | "active"
  | "banned";
export type RewardType = "flag" | "code" | "custom";
export type DeduplicationStrategy = "email" | "email+ip";

export interface FieldDefinition {
  name: string;
  type: "text" | "number" | "select" | "url";
  label: string;
  required: boolean;
  options?: string[]; // for select type
}

export interface ReferralConfig {
  enabled: boolean;
  positionBump: number;
  maxBumps?: number;
}

export interface RateLimitConfig {
  window: string; // e.g. "1m", "1h"
  max: number;
}

export interface ProjectConfig {
  mode: WaitlistMode;
  name: string;
  maxSubscribers?: number;
  requireEmailVerification: boolean;
  customFields?: FieldDefinition[];
  referral: ReferralConfig;
  rewards: RewardTierConfig[];
  deduplication: DeduplicationStrategy;
  rateLimit: RateLimitConfig;
}

export interface RewardTierConfig {
  name: string;
  threshold: number;
  rewardType: RewardType;
  rewardValue: string;
}

export interface SubscribeRequest {
  email: string;
  name?: string;
  referralCode?: string;
  metadata?: Record<string, unknown>;
  channel?: string;
  ip?: string;
}

export interface SubscribeResponse {
  id: string;
  email: string;
  position: number | null;
  referralCode: string;
  status: SubscriberStatus;
  totalSignups: number;
}

export interface SubscriberStatusResponse {
  position: number | null;
  referralCount: number;
  referralCode: string;
  rewards: string[];
  status: SubscriberStatus;
  experiment?: { name: string; variant: string };
}

export interface LeaderboardEntry {
  rank: number;
  name: string | null;
  referralCount: number;
}

export interface PublicStats {
  totalSignups: number;
  spotsRemaining: number | null;
  referralsMade: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  projectId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface AnalyticsOverview {
  totalSignups: number;
  todaySignups: number;
  totalReferrals: number;
  todayReferrals: number;
  conversionRate: number;
  kFactor: number;
}

export interface TimeseriesPoint {
  date: string;
  signups: number;
  referrals: number;
  kFactor: number;
}

export interface CohortRow {
  cohortWeek: string;
  size: number;
  referred1d: number;
  referred7d: number;
  referred30d: number;
  depth1: number;
  depth2: number;
  depth3: number;
}

export interface ChannelStats {
  channel: string;
  clicks: number;
  signups: number;
  conversionRate: number;
}
```

- [ ] **Step 3: Create schemas.ts**

```typescript
// packages/shared/src/schemas.ts
import { z } from "zod";

export const subscribeSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().max(200).optional(),
  referralCode: z
    .string()
    .regex(/^[a-zA-Z0-9]{6,12}$/, "Invalid referral code")
    .optional(),
  metadata: z.record(z.unknown()).optional(),
  channel: z
    .enum([
      "twitter",
      "facebook",
      "linkedin",
      "whatsapp",
      "email",
      "copy",
      "other",
    ])
    .optional(),
});

export const fieldDefinitionSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["text", "number", "select", "url"]),
  label: z.string().min(1).max(100),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

export const referralConfigSchema = z.object({
  enabled: z.boolean(),
  positionBump: z.number().int().min(0).max(100).default(1),
  maxBumps: z.number().int().min(1).optional(),
});

export const rateLimitConfigSchema = z.object({
  window: z
    .string()
    .regex(/^\d+[smh]$/, 'Must be like "1m", "30s", or "1h"'),
  max: z.number().int().min(1).max(10000),
});

export const rewardTierConfigSchema = z.object({
  name: z.string().min(1).max(100),
  threshold: z.number().int().min(1),
  rewardType: z.enum(["flag", "code", "custom"]),
  rewardValue: z.string().min(1).max(500),
});

export const projectConfigSchema = z.object({
  mode: z.enum(["prelaunch", "gated", "viral"]),
  name: z.string().min(1).max(200),
  maxSubscribers: z.number().int().min(1).optional(),
  requireEmailVerification: z.boolean().default(false),
  customFields: z.array(fieldDefinitionSchema).max(20).optional(),
  referral: referralConfigSchema,
  rewards: z.array(rewardTierConfigSchema).max(10).default([]),
  deduplication: z.enum(["email", "email+ip"]).default("email"),
  rateLimit: rateLimitConfigSchema.default({ window: "1m", max: 10 }),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const timeRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["approve", "reject", "ban"]),
});

export const webhookEndpointSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  secret: z.string().min(16).max(128),
  events: z
    .array(
      z.enum([
        "subscriber.created",
        "subscriber.verified",
        "subscriber.approved",
        "subscriber.rejected",
        "referral.created",
        "reward.unlocked",
        "position.changed",
        "experiment.assigned",
        "waitlist.milestone",
      ])
    )
    .min(1),
});

export const experimentSchema = z.object({
  name: z.string().min(1).max(200),
  variants: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        weight: z.number().min(0).max(100),
      })
    )
    .min(2)
    .max(5),
});
```

- [ ] **Step 4: Create constants.ts**

```typescript
// packages/shared/src/constants.ts

export const REFERRAL_CODE_LENGTH = 8;
export const API_KEY_PREFIX = "wl_pk_";
export const API_SECRET_PREFIX = "wl_sk_";

export const WEBHOOK_EVENTS = [
  "subscriber.created",
  "subscriber.verified",
  "subscriber.approved",
  "subscriber.rejected",
  "referral.created",
  "reward.unlocked",
  "position.changed",
  "experiment.assigned",
  "waitlist.milestone",
] as const;

export const SHARE_CHANNELS = [
  "twitter",
  "facebook",
  "linkedin",
  "whatsapp",
  "email",
  "copy",
  "other",
] as const;

export const WEBHOOK_MAX_RETRIES = 5;
export const WEBHOOK_RETRY_DELAYS = [
  60_000, // 1 min
  300_000, // 5 min
  1_800_000, // 30 min
  7_200_000, // 2 hours
  43_200_000, // 12 hours
];

export const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "grr.la",
  "dispostable.com",
  "trashmail.com",
];

export const ANALYTICS_CACHE_TTL = 300; // 5 minutes in seconds
export const LEADERBOARD_CACHE_TTL = 60; // 1 minute
```

- [ ] **Step 5: Update index.ts to re-export**

```typescript
// packages/shared/src/index.ts
export * from "./types.js";
export * from "./schemas.js";
export * from "./constants.js";
```

- [ ] **Step 6: Build and verify**

Run: `pnpm build --filter=@waitlist/shared`
Expected: Successful build, `packages/shared/dist/` created with `.js` and `.d.ts` files

- [ ] **Step 7: Commit**

```bash
git add packages/shared/
git commit -m "feat: add shared types, validation schemas, and constants"
```

---

### Task 3: Database Schema

**Files:**
- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/index.ts`
- Create: `apps/api/drizzle.config.ts`

- [ ] **Step 1: Create database schema**

```typescript
// apps/api/src/db/schema.ts
import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  real,
} from "drizzle-orm/pg-core";

// ─── Projects ───────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull(), // prelaunch | gated | viral
  config: jsonb("config").notNull(), // ProjectConfig
  apiKey: varchar("api_key", { length: 64 }).notNull().unique(),
  apiKeyHash: varchar("api_key_hash", { length: 128 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Subscribers ────────────────────────────────────

export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 200 }),
    referralCode: varchar("referral_code", { length: 12 }).notNull(),
    referredBy: uuid("referred_by").references(() => subscribers.id, {
      onDelete: "set null",
    }),
    position: integer("position"), // null in gated mode
    status: varchar("status", { length: 20 }).notNull().default("waiting"),
    emailVerified: boolean("email_verified").notNull().default(false),
    metadata: jsonb("metadata").default({}),
    signupIp: varchar("signup_ip", { length: 45 }),
    signupChannel: varchar("signup_channel", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("subscribers_project_email_idx").on(
      table.projectId,
      table.email
    ),
    uniqueIndex("subscribers_referral_code_idx").on(table.referralCode),
    index("subscribers_project_status_idx").on(table.projectId, table.status),
    index("subscribers_project_position_idx").on(
      table.projectId,
      table.position
    ),
    index("subscribers_referred_by_idx").on(table.referredBy),
  ]
);

// ─── Referrals ──────────────────────────────────────

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    referredId: uuid("referred_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    channel: varchar("channel", { length: 20 }),
    verified: boolean("verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("referrals_referrer_idx").on(table.referrerId),
    index("referrals_project_idx").on(table.projectId),
    uniqueIndex("referrals_referred_unique_idx").on(table.referredId),
  ]
);

// ─── Reward Tiers ───────────────────────────────────

export const rewardTiers = pgTable(
  "reward_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    threshold: integer("threshold").notNull(),
    rewardType: varchar("reward_type", { length: 20 }).notNull(),
    rewardValue: varchar("reward_value", { length: 500 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("reward_tiers_project_idx").on(table.projectId)]
);

// ─── Reward Unlocks ─────────────────────────────────

export const rewardUnlocks = pgTable(
  "reward_unlocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    tierId: uuid("tier_id")
      .notNull()
      .references(() => rewardTiers.id, { onDelete: "cascade" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("reward_unlocks_subscriber_tier_idx").on(
      table.subscriberId,
      table.tierId
    ),
    index("reward_unlocks_subscriber_idx").on(table.subscriberId),
  ]
);

// ─── Events ─────────────────────────────────────────

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    subscriberId: uuid("subscriber_id").references(() => subscribers.id, {
      onDelete: "set null",
    }),
    data: jsonb("data").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_project_type_idx").on(table.projectId, table.type),
    index("events_created_at_idx").on(table.createdAt),
  ]
);

// ─── Analytics: Daily ───────────────────────────────

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
    signups: integer("signups").notNull().default(0),
    referrals: integer("referrals").notNull().default(0),
    verifiedReferrals: integer("verified_referrals").notNull().default(0),
    kFactor: real("k_factor").notNull().default(0),
    rewardUnlocks: integer("reward_unlocks").notNull().default(0),
  },
  (table) => [
    uniqueIndex("analytics_daily_project_date_idx").on(
      table.projectId,
      table.date
    ),
  ]
);

// ─── Analytics: Cohorts ─────────────────────────────

export const analyticsCohorts = pgTable(
  "analytics_cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cohortWeek: varchar("cohort_week", { length: 10 }).notNull(), // YYYY-WNN
    size: integer("size").notNull().default(0),
    referred1d: integer("referred_1d").notNull().default(0),
    referred7d: integer("referred_7d").notNull().default(0),
    referred30d: integer("referred_30d").notNull().default(0),
    depth1: integer("depth_1").notNull().default(0),
    depth2: integer("depth_2").notNull().default(0),
    depth3: integer("depth_3").notNull().default(0),
  },
  (table) => [
    uniqueIndex("analytics_cohorts_project_week_idx").on(
      table.projectId,
      table.cohortWeek
    ),
  ]
);

// ─── Experiments ────────────────────────────────────

export const experiments = pgTable(
  "experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    variants: jsonb("variants").notNull(), // { name, weight }[]
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("experiments_project_idx").on(table.projectId)]
);

// ─── Experiment Assignments ─────────────────────────

export const experimentAssignments = pgTable(
  "experiment_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id")
      .notNull()
      .references(() => subscribers.id, { onDelete: "cascade" }),
    variant: varchar("variant", { length: 100 }).notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("experiment_assignments_exp_sub_idx").on(
      table.experimentId,
      table.subscriberId
    ),
    index("experiment_assignments_experiment_idx").on(table.experimentId),
  ]
);

// ─── Webhook Endpoints ──────────────────────────────

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 2048 }).notNull(),
    secret: varchar("secret", { length: 128 }).notNull(),
    events: jsonb("events").notNull(), // string[]
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("webhook_endpoints_project_idx").on(table.projectId)]
);

// ─── Webhook Deliveries ─────────────────────────────

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 50 }).notNull(),
    payload: jsonb("payload").notNull(),
    statusCode: integer("status_code"),
    responseBody: text("response_body"),
    attempt: integer("attempt").notNull().default(1),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("webhook_deliveries_endpoint_idx").on(table.endpointId),
    index("webhook_deliveries_next_retry_idx").on(table.nextRetryAt),
  ]
);

// ─── Admin Users ────────────────────────────────────

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 256 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

- [ ] **Step 2: Create database connection module**

```typescript
// apps/api/src/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
export * from "./schema.js";
```

- [ ] **Step 3: Create drizzle config**

```typescript
// apps/api/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

- [ ] **Step 4: Generate and run migrations**

Run: `docker compose up -d`
Run: `cd apps/api && pnpm db:generate`
Expected: Migration files generated in `apps/api/drizzle/migrations/`

Run: `DATABASE_URL=postgres://waitlist:waitlist@localhost:5434/waitlist pnpm db:migrate`
Expected: All tables created successfully

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/ apps/api/drizzle/ apps/api/drizzle.config.ts
git commit -m "feat: add database schema with all tables and migrations"
```

---

### Task 4: API Server Foundation

**Files:**
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/lib/redis.ts`
- Create: `apps/api/src/lib/queue.ts`
- Create: `apps/api/src/lib/referral-code.ts`
- Create: `apps/api/src/middleware/api-key.ts`
- Create: `apps/api/src/middleware/jwt.ts`
- Create: `apps/api/src/routes/index.ts`
- Test: `apps/api/src/__tests__/referral-code.test.ts`

- [ ] **Step 1: Write failing test for referral code generation**

```typescript
// apps/api/src/__tests__/referral-code.test.ts
import { describe, it, expect } from "vitest";
import { generateReferralCode } from "../lib/referral-code.js";

describe("generateReferralCode", () => {
  it("generates a code of the correct length", () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
  });

  it("generates URL-safe alphanumeric codes", () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateReferralCode()));
    expect(codes.size).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- src/__tests__/referral-code.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement referral code generator**

```typescript
// apps/api/src/lib/referral-code.ts
import { nanoid, customAlphabet } from "nanoid";
import { REFERRAL_CODE_LENGTH } from "@waitlist/shared";

const alphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, REFERRAL_CODE_LENGTH);

export function generateReferralCode(): string {
  return generate();
}

export function generateApiKey(prefix: string): string {
  return `${prefix}${nanoid(32)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test -- src/__tests__/referral-code.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Create Redis and BullMQ setup**

```typescript
// apps/api/src/lib/redis.ts
import Redis from "ioredis";

export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null });
}
```

```typescript
// apps/api/src/lib/queue.ts
import { Queue, Worker, type Processor } from "bullmq";
import type Redis from "ioredis";

export function createQueue(name: string, connection: Redis): Queue {
  return new Queue(name, { connection });
}

export function createWorker<T>(
  name: string,
  processor: Processor<T>,
  connection: Redis,
  concurrency = 1
): Worker<T> {
  return new Worker(name, processor, { connection, concurrency });
}
```

- [ ] **Step 6: Create API key middleware**

```typescript
// apps/api/src/middleware/api-key.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { projects } from "../db/schema.js";
import type { Database } from "../db/index.js";
import { createHash } from "node:crypto";

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function apiKeyAuth(db: Database) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const apiKey = request.headers["x-api-key"] as string | undefined;
    if (!apiKey) {
      return reply
        .status(401)
        .send({ error: "Missing X-API-Key header" });
    }

    const hash = hashApiKey(apiKey);
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.apiKeyHash, hash))
      .limit(1);

    if (!project) {
      return reply.status(401).send({ error: "Invalid API key" });
    }

    request.project = project;
  };
}

export { hashApiKey };
```

- [ ] **Step 7: Create JWT middleware**

```typescript
// apps/api/src/middleware/jwt.ts
import type { FastifyInstance } from "fastify";
import fjwt from "@fastify/jwt";

export async function registerJwt(
  app: FastifyInstance,
  secret: string
) {
  await app.register(fjwt, { secret });

  app.decorate(
    "authenticateAdmin",
    async function (request: any, reply: any) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
    }
  );
}
```

- [ ] **Step 8: Create route index (placeholder)**

```typescript
// apps/api/src/routes/index.ts
import type { FastifyInstance } from "fastify";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));
}
```

- [ ] **Step 9: Create server entry point**

```typescript
// apps/api/src/server.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fstatic from "@fastify/static";
import { createDb } from "./db/index.js";
import { createRedis } from "./lib/redis.js";
import { registerJwt } from "./middleware/jwt.js";
import { registerRoutes } from "./routes/index.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const port = Number(process.env.PORT ?? 3400);
const host = process.env.HOST ?? "0.0.0.0";
const jwtSecret = process.env.ADMIN_JWT_SECRET;
const corsOrigins = process.env.CORS_ORIGINS?.split(",") ?? ["*"];

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!redisUrl) {
  console.error("REDIS_URL is required");
  process.exit(1);
}
if (!jwtSecret) {
  console.error("ADMIN_JWT_SECRET is required");
  process.exit(1);
}

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
const db = createDb(databaseUrl);
const redis = createRedis(redisUrl);

// Decorate with shared instances
app.decorate("db", db);
app.decorate("redis", redis);

// Plugins
await app.register(cors, { origin: corsOrigins });
await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  redis,
});
await registerJwt(app, jwtSecret);

// Routes
await registerRoutes(app);

// Graceful shutdown
let shuttingDown = false;

app.addHook("onRequest", async (_request, reply) => {
  if (shuttingDown) {
    reply.code(503).send({ error: "Service is shutting down" });
  }
});

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down gracefully...");

  const timer = setTimeout(() => {
    console.error("Shutdown timed out after 30s");
    process.exit(1);
  }, 30_000);

  try {
    await app.close();
    await redis.quit();
    clearTimeout(timer);
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Start
try {
  await app.listen({ port, host });
  console.log(`Server listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
```

- [ ] **Step 10: Add Fastify type augmentation**

```typescript
// apps/api/src/types.d.ts
import type { Database } from "./db/index.js";
import type Redis from "ioredis";
import type { InferSelectModel } from "drizzle-orm";
import type { projects } from "./db/schema.js";

type Project = InferSelectModel<typeof projects>;

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    redis: Redis;
    authenticateAdmin: (request: any, reply: any) => Promise<void>;
  }
  interface FastifyRequest {
    project?: Project;
  }
}
```

- [ ] **Step 11: Verify server starts**

Run: `cd apps/api && DATABASE_URL=postgres://waitlist:waitlist@localhost:5434/waitlist REDIS_URL=redis://localhost:6381 ADMIN_JWT_SECRET=test-secret-at-least-32-characters-long pnpm dev`
Expected: "Server listening on 0.0.0.0:3400"

Test health: `curl http://localhost:3400/health`
Expected: `{"status":"ok"}`

Stop the server.

- [ ] **Step 12: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add Fastify server with Redis, BullMQ, API key and JWT middleware"
```

---

## Phase 2: Core Business Logic

### Task 5: Waitlist Service & Subscribe Endpoint

**Files:**
- Create: `apps/api/src/services/waitlist.ts`
- Create: `apps/api/src/services/events.ts`
- Create: `apps/api/src/routes/subscribe.ts`
- Create: `apps/api/src/__tests__/waitlist.test.ts`

- [ ] **Step 1: Write failing tests for waitlist service**

```typescript
// apps/api/src/__tests__/waitlist.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WaitlistService } from "../services/waitlist.js";

// In-memory mock DB for unit tests
function createMockDb() {
  const subscribers: any[] = [];
  let nextPosition = 1;

  return {
    subscribers,
    insert: vi.fn().mockImplementation((data: any) => {
      const sub = {
        id: crypto.randomUUID(),
        position: nextPosition++,
        referralCode: "test1234",
        status: "waiting",
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      };
      subscribers.push(sub);
      return { returning: () => [sub] };
    }),
    findByEmail: vi.fn().mockImplementation((projectId: string, email: string) => {
      return subscribers.find(
        (s) => s.projectId === projectId && s.email === email
      );
    }),
    countByProject: vi.fn().mockReturnValue(0),
  };
}

describe("WaitlistService", () => {
  const projectId = "proj-123";
  const prelaunchConfig = {
    mode: "prelaunch" as const,
    name: "Test Waitlist",
    requireEmailVerification: false,
    referral: { enabled: true, positionBump: 1 },
    rewards: [],
    deduplication: "email" as const,
    rateLimit: { window: "1m", max: 10 },
  };

  it("assigns position in prelaunch mode", () => {
    const service = new WaitlistService();
    const status = service.getInitialStatus("prelaunch");
    expect(status).toBe("waiting");
  });

  it("assigns pending status in gated mode", () => {
    const service = new WaitlistService();
    const status = service.getInitialStatus("gated");
    expect(status).toBe("pending");
  });

  it("assigns active status in viral mode", () => {
    const service = new WaitlistService();
    const status = service.getInitialStatus("viral");
    expect(status).toBe("active");
  });

  it("returns null position in gated mode", () => {
    const service = new WaitlistService();
    const shouldAssign = service.shouldAssignPosition("gated");
    expect(shouldAssign).toBe(false);
  });

  it("returns true for position in prelaunch mode", () => {
    const service = new WaitlistService();
    const shouldAssign = service.shouldAssignPosition("prelaunch");
    expect(shouldAssign).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- src/__tests__/waitlist.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement event emitter service**

```typescript
// apps/api/src/services/events.ts
import type { Database } from "../db/index.js";
import { events } from "../db/schema.js";
import type { Queue } from "bullmq";

export class EventService {
  constructor(
    private db: Database,
    private webhookQueue?: Queue,
    private analyticsQueue?: Queue
  ) {}

  async emit(
    projectId: string,
    type: string,
    subscriberId: string | null,
    data: Record<string, unknown> = {}
  ) {
    const [event] = await this.db
      .insert(events)
      .values({
        projectId,
        type,
        subscriberId,
        data,
      })
      .returning();

    // Queue webhook dispatch
    if (this.webhookQueue) {
      await this.webhookQueue.add("dispatch", {
        eventId: event.id,
        projectId,
        type,
        data: { subscriberId, ...data },
      });
    }

    // Queue analytics update
    if (this.analyticsQueue) {
      await this.analyticsQueue.add("aggregate", {
        projectId,
        type,
        timestamp: event.createdAt.toISOString(),
      });
    }

    return event;
  }
}
```

- [ ] **Step 4: Implement waitlist service**

```typescript
// apps/api/src/services/waitlist.ts
import { eq, and, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { subscribers, projects } from "../db/schema.js";
import { generateReferralCode } from "../lib/referral-code.js";
import type { EventService } from "./events.js";
import type { WaitlistMode, SubscriberStatus } from "@waitlist/shared";

export class WaitlistService {
  constructor(
    private db?: Database,
    private eventService?: EventService
  ) {}

  getInitialStatus(mode: WaitlistMode): SubscriberStatus {
    switch (mode) {
      case "prelaunch":
        return "waiting";
      case "gated":
        return "pending";
      case "viral":
        return "active";
    }
  }

  shouldAssignPosition(mode: WaitlistMode): boolean {
    return mode !== "gated";
  }

  async subscribe(
    projectId: string,
    mode: WaitlistMode,
    input: {
      email: string;
      name?: string;
      referredBy?: string;
      metadata?: Record<string, unknown>;
      ip?: string;
      channel?: string;
    }
  ) {
    if (!this.db) throw new Error("Database required");

    // Check duplicate
    const [existing] = await this.db
      .select()
      .from(subscribers)
      .where(
        and(
          eq(subscribers.projectId, projectId),
          eq(subscribers.email, input.email)
        )
      )
      .limit(1);

    if (existing) {
      return { subscriber: existing, isNew: false };
    }

    // Get next position
    let position: number | null = null;
    if (this.shouldAssignPosition(mode)) {
      const [result] = await this.db
        .select({
          maxPos: sql<number>`coalesce(max(${subscribers.position}), 0)`,
        })
        .from(subscribers)
        .where(eq(subscribers.projectId, projectId));
      position = (result?.maxPos ?? 0) + 1;
    }

    const referralCode = generateReferralCode();
    const status = this.getInitialStatus(mode);

    const [subscriber] = await this.db
      .insert(subscribers)
      .values({
        projectId,
        email: input.email,
        name: input.name,
        referralCode,
        referredBy: input.referredBy,
        position,
        status,
        metadata: input.metadata ?? {},
        signupIp: input.ip,
        signupChannel: input.channel,
      })
      .returning();

    if (this.eventService) {
      await this.eventService.emit(projectId, "subscriber.created", subscriber.id, {
        email: subscriber.email,
        position: subscriber.position,
        referredBy: input.referredBy,
        channel: input.channel,
      });
    }

    return { subscriber, isNew: true };
  }

  async getStatus(projectId: string, email: string) {
    if (!this.db) throw new Error("Database required");

    const [subscriber] = await this.db
      .select()
      .from(subscribers)
      .where(
        and(
          eq(subscribers.projectId, projectId),
          eq(subscribers.email, email)
        )
      )
      .limit(1);

    return subscriber ?? null;
  }

  async getCount(projectId: string): Promise<number> {
    if (!this.db) throw new Error("Database required");

    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(eq(subscribers.projectId, projectId));

    return Number(result?.count ?? 0);
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/api && pnpm test -- src/__tests__/waitlist.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 6: Create subscribe route**

```typescript
// apps/api/src/routes/subscribe.ts
import type { FastifyInstance } from "fastify";
import { subscribeSchema } from "@waitlist/shared";
import { eq } from "drizzle-orm";
import { subscribers, referrals, rewardUnlocks, rewardTiers } from "../db/schema.js";
import { WaitlistService } from "../services/waitlist.js";
import { EventService } from "../services/events.js";
import { apiKeyAuth } from "../middleware/api-key.js";
import { sql, and } from "drizzle-orm";

export async function subscribeRoutes(app: FastifyInstance) {
  const waitlistService = new WaitlistService(app.db, new EventService(app.db));

  // Pre-handler: validate API key
  app.addHook("preHandler", apiKeyAuth(app.db));

  // POST /api/v1/subscribe
  app.post("/api/v1/subscribe", async (request, reply) => {
    const project = request.project!;
    const config = project.config as any;

    const parsed = subscribeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, name, referralCode, metadata, channel } = parsed.data;

    // Check max subscribers
    if (config.maxSubscribers) {
      const count = await waitlistService.getCount(project.id);
      if (count >= config.maxSubscribers) {
        return reply.status(409).send({ error: "Waitlist is full" });
      }
    }

    // Resolve referrer
    let referredBy: string | undefined;
    if (referralCode && config.referral?.enabled) {
      const [referrer] = await app.db
        .select()
        .from(subscribers)
        .where(eq(subscribers.referralCode, referralCode))
        .limit(1);
      if (referrer && referrer.projectId === project.id) {
        referredBy = referrer.id;
      }
    }

    const { subscriber, isNew } = await waitlistService.subscribe(
      project.id,
      config.mode,
      {
        email,
        name,
        referredBy,
        metadata,
        ip: request.ip,
        channel,
      }
    );

    // If referred, create referral record
    if (isNew && referredBy) {
      await app.db.insert(referrals).values({
        projectId: project.id,
        referrerId: referredBy,
        referredId: subscriber.id,
        channel,
        verified: !config.requireEmailVerification,
      });
    }

    const totalSignups = await waitlistService.getCount(project.id);

    return reply.status(isNew ? 201 : 200).send({
      id: subscriber.id,
      email: subscriber.email,
      position: subscriber.position,
      referralCode: subscriber.referralCode,
      status: subscriber.status,
      totalSignups,
    });
  });

  // GET /api/v1/subscribe/:email/status
  app.get("/api/v1/subscribe/:email/status", async (request, reply) => {
    const project = request.project!;
    const { email } = request.params as { email: string };

    const subscriber = await waitlistService.getStatus(project.id, email);
    if (!subscriber) {
      return reply.status(404).send({ error: "Subscriber not found" });
    }

    // Count referrals
    const [refCount] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(eq(referrals.referrerId, subscriber.id));

    // Get unlocked rewards
    const unlocked = await app.db
      .select({ name: rewardTiers.name })
      .from(rewardUnlocks)
      .innerJoin(rewardTiers, eq(rewardUnlocks.tierId, rewardTiers.id))
      .where(eq(rewardUnlocks.subscriberId, subscriber.id));

    return reply.send({
      position: subscriber.position,
      referralCount: Number(refCount?.count ?? 0),
      referralCode: subscriber.referralCode,
      rewards: unlocked.map((r) => r.name),
      status: subscriber.status,
    });
  });
}
```

- [ ] **Step 7: Register subscribe routes in index**

```typescript
// apps/api/src/routes/index.ts
import type { FastifyInstance } from "fastify";
import { subscribeRoutes } from "./subscribe.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));
  await app.register(subscribeRoutes);
}
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add waitlist service, event emitter, and subscribe endpoints"
```

---

### Task 6: Referral Tracking & Position Bumping

**Files:**
- Create: `apps/api/src/services/referral.ts`
- Create: `apps/api/src/services/position.ts`
- Create: `apps/api/src/__tests__/referral.test.ts`
- Create: `apps/api/src/__tests__/position.test.ts`

- [ ] **Step 1: Write failing tests for position service**

```typescript
// apps/api/src/__tests__/position.test.ts
import { describe, it, expect } from "vitest";
import { calculateNewPosition } from "../services/position.js";

describe("calculateNewPosition", () => {
  it("bumps position by configured amount", () => {
    const newPos = calculateNewPosition(100, 1, undefined);
    expect(newPos).toBe(99);
  });

  it("bumps by custom amount", () => {
    const newPos = calculateNewPosition(50, 5, undefined);
    expect(newPos).toBe(45);
  });

  it("does not go below position 1", () => {
    const newPos = calculateNewPosition(2, 5, undefined);
    expect(newPos).toBe(1);
  });

  it("respects maxBumps cap", () => {
    // currentPosition=100, bump=1, maxBumps=3, already bumped 3 times
    const newPos = calculateNewPosition(97, 1, 3, 3);
    expect(newPos).toBe(97); // no more bumps allowed
  });

  it("allows bump when under maxBumps", () => {
    const newPos = calculateNewPosition(98, 1, 3, 2);
    expect(newPos).toBe(97);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- src/__tests__/position.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement position service**

```typescript
// apps/api/src/services/position.ts
import { eq, and, gt, lte, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { subscribers } from "../db/schema.js";

export function calculateNewPosition(
  currentPosition: number,
  bumpAmount: number,
  maxBumps: number | undefined,
  totalBumpsApplied: number = 0
): number {
  if (maxBumps !== undefined && totalBumpsApplied >= maxBumps) {
    return currentPosition;
  }
  return Math.max(1, currentPosition - bumpAmount);
}

export async function applyPositionBump(
  db: Database,
  subscriberId: string,
  projectId: string,
  bumpAmount: number,
  maxBumps?: number
): Promise<number | null> {
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.id, subscriberId))
    .limit(1);

  if (!subscriber || subscriber.position === null) return null;

  // Count how many bumps already applied (referral count)
  const [refResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscribers)
    .where(eq(subscribers.referredBy, subscriberId));

  const totalBumps = Number(refResult?.count ?? 0);
  const newPosition = calculateNewPosition(
    subscriber.position,
    bumpAmount,
    maxBumps,
    totalBumps - 1 // subtract 1 because current referral is already counted
  );

  if (newPosition === subscriber.position) return subscriber.position;

  const oldPosition = subscriber.position;

  // Move others down to fill the gap: everyone between newPosition and oldPosition shifts +1
  await db
    .update(subscribers)
    .set({
      position: sql`${subscribers.position} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(subscribers.projectId, projectId),
        lte(subscribers.position, oldPosition - 1),
        gt(subscribers.position, newPosition - 1)
      )
    );

  // Set the referrer's new position
  await db
    .update(subscribers)
    .set({ position: newPosition, updatedAt: new Date() })
    .where(eq(subscribers.id, subscriberId));

  return newPosition;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test -- src/__tests__/position.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Write failing tests for referral service**

```typescript
// apps/api/src/__tests__/referral.test.ts
import { describe, it, expect } from "vitest";
import { ReferralService } from "../services/referral.js";

describe("ReferralService", () => {
  it("detects self-referral", () => {
    const service = new ReferralService();
    expect(service.isSelfReferral("user@example.com", "user@example.com")).toBe(true);
  });

  it("allows different emails", () => {
    const service = new ReferralService();
    expect(service.isSelfReferral("a@example.com", "b@example.com")).toBe(false);
  });

  it("detects disposable email domains", () => {
    const service = new ReferralService();
    expect(service.isDisposableEmail("test@mailinator.com")).toBe(true);
  });

  it("allows valid email domains", () => {
    const service = new ReferralService();
    expect(service.isDisposableEmail("test@gmail.com")).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- src/__tests__/referral.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Implement referral service**

```typescript
// apps/api/src/services/referral.ts
import { eq, and, sql, gte } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  referrals,
  subscribers,
  rewardTiers,
  rewardUnlocks,
} from "../db/schema.js";
import { DISPOSABLE_EMAIL_DOMAINS } from "@waitlist/shared";
import type { EventService } from "./events.js";
import { applyPositionBump } from "./position.js";

export class ReferralService {
  constructor(
    private db?: Database,
    private eventService?: EventService
  ) {}

  isSelfReferral(referrerEmail: string, referredEmail: string): boolean {
    return referrerEmail.toLowerCase() === referredEmail.toLowerCase();
  }

  isDisposableEmail(email: string): boolean {
    const domain = email.split("@")[1]?.toLowerCase();
    return domain ? DISPOSABLE_EMAIL_DOMAINS.includes(domain) : false;
  }

  async isSameIpRecent(
    projectId: string,
    ip: string,
    windowMs: number = 3600_000
  ): Promise<boolean> {
    if (!this.db) throw new Error("Database required");

    const since = new Date(Date.now() - windowMs);
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(
        and(
          eq(subscribers.projectId, projectId),
          eq(subscribers.signupIp, ip),
          gte(subscribers.createdAt, since)
        )
      );

    return Number(result?.count ?? 0) > 0;
  }

  async processReferral(
    projectId: string,
    referrerId: string,
    referredId: string,
    config: { positionBump: number; maxBumps?: number }
  ) {
    if (!this.db || !this.eventService) throw new Error("Dependencies required");

    // Emit referral event
    await this.eventService.emit(projectId, "referral.created", referrerId, {
      referredId,
    });

    // Apply position bump
    const newPosition = await applyPositionBump(
      this.db,
      referrerId,
      projectId,
      config.positionBump,
      config.maxBumps
    );

    if (newPosition !== null) {
      await this.eventService.emit(projectId, "position.changed", referrerId, {
        newPosition,
      });
    }

    // Check reward tier unlocks
    await this.checkRewardUnlocks(projectId, referrerId);
  }

  async checkRewardUnlocks(projectId: string, subscriberId: string) {
    if (!this.db || !this.eventService) throw new Error("Dependencies required");

    // Count verified referrals
    const [refResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(
        and(eq(referrals.referrerId, subscriberId), eq(referrals.verified, true))
      );

    const referralCount = Number(refResult?.count ?? 0);

    // Get all tiers for this project
    const tiers = await this.db
      .select()
      .from(rewardTiers)
      .where(eq(rewardTiers.projectId, projectId));

    // Check each tier
    for (const tier of tiers) {
      if (referralCount >= tier.threshold) {
        // Check if already unlocked
        const [existing] = await this.db
          .select()
          .from(rewardUnlocks)
          .where(
            and(
              eq(rewardUnlocks.subscriberId, subscriberId),
              eq(rewardUnlocks.tierId, tier.id)
            )
          )
          .limit(1);

        if (!existing) {
          await this.db.insert(rewardUnlocks).values({
            subscriberId,
            tierId: tier.id,
          });

          await this.eventService.emit(
            projectId,
            "reward.unlocked",
            subscriberId,
            {
              tierName: tier.name,
              rewardType: tier.rewardType,
              rewardValue: tier.rewardValue,
              threshold: tier.threshold,
            }
          );
        }
      }
    }
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd apps/api && pnpm test -- src/__tests__/referral.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add referral tracking, position bumping, and reward unlock logic"
```

---

### Task 7: Leaderboard & Stats Endpoints

**Files:**
- Create: `apps/api/src/routes/leaderboard.ts`
- Create: `apps/api/src/routes/stats.ts`
- Modify: `apps/api/src/routes/index.ts`

- [ ] **Step 1: Create leaderboard route**

```typescript
// apps/api/src/routes/leaderboard.ts
import type { FastifyInstance } from "fastify";
import { eq, sql, desc } from "drizzle-orm";
import { subscribers, referrals } from "../db/schema.js";
import { apiKeyAuth } from "../middleware/api-key.js";
import { LEADERBOARD_CACHE_TTL } from "@waitlist/shared";

export async function leaderboardRoutes(app: FastifyInstance) {
  app.addHook("preHandler", apiKeyAuth(app.db));

  app.get("/api/v1/leaderboard", async (request, reply) => {
    const project = request.project!;
    const { limit = "10" } = request.query as { limit?: string };
    const take = Math.min(Number(limit) || 10, 100);

    // Check Redis cache
    const cacheKey = `leaderboard:${project.id}:${take}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const results = await app.db
      .select({
        name: subscribers.name,
        referralCount: sql<number>`count(${referrals.id})`.as("referral_count"),
      })
      .from(subscribers)
      .leftJoin(referrals, eq(referrals.referrerId, subscribers.id))
      .where(eq(subscribers.projectId, project.id))
      .groupBy(subscribers.id, subscribers.name)
      .having(sql`count(${referrals.id}) > 0`)
      .orderBy(desc(sql`referral_count`))
      .limit(take);

    const leaderboard = results.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      referralCount: Number(r.referralCount),
    }));

    await app.redis.setex(cacheKey, LEADERBOARD_CACHE_TTL, JSON.stringify(leaderboard));

    return reply.send(leaderboard);
  });
}
```

- [ ] **Step 2: Create stats route**

```typescript
// apps/api/src/routes/stats.ts
import type { FastifyInstance } from "fastify";
import { eq, sql } from "drizzle-orm";
import { subscribers, referrals } from "../db/schema.js";
import { apiKeyAuth } from "../middleware/api-key.js";
import { ANALYTICS_CACHE_TTL } from "@waitlist/shared";

export async function statsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", apiKeyAuth(app.db));

  app.get("/api/v1/stats", async (request, reply) => {
    const project = request.project!;
    const config = project.config as any;

    const cacheKey = `stats:${project.id}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const [signupResult] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(eq(subscribers.projectId, project.id));

    const [referralResult] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(eq(referrals.projectId, project.id));

    const totalSignups = Number(signupResult?.count ?? 0);
    const spotsRemaining = config.maxSubscribers
      ? Math.max(0, config.maxSubscribers - totalSignups)
      : null;

    const stats = {
      totalSignups,
      spotsRemaining,
      referralsMade: Number(referralResult?.count ?? 0),
    };

    await app.redis.setex(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(stats));

    return reply.send(stats);
  });
}
```

- [ ] **Step 3: Register routes**

```typescript
// apps/api/src/routes/index.ts
import type { FastifyInstance } from "fastify";
import { subscribeRoutes } from "./subscribe.js";
import { leaderboardRoutes } from "./leaderboard.js";
import { statsRoutes } from "./stats.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));
  await app.register(subscribeRoutes);
  await app.register(leaderboardRoutes);
  await app.register(statsRoutes);
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/
git commit -m "feat: add leaderboard and stats public endpoints with Redis caching"
```

---

### Task 8: Webhook System

**Files:**
- Create: `apps/api/src/services/webhook.ts`
- Create: `apps/api/src/workers/webhook.ts`
- Create: `apps/api/src/__tests__/webhook.test.ts`

- [ ] **Step 1: Write failing test for webhook signature**

```typescript
// apps/api/src/__tests__/webhook.test.ts
import { describe, it, expect } from "vitest";
import { signPayload, verifySignature } from "../services/webhook.js";

describe("Webhook Signing", () => {
  const secret = "test-secret-key-for-webhooks";
  const payload = JSON.stringify({
    type: "subscriber.created",
    data: { email: "test@example.com" },
  });

  it("generates a valid HMAC-SHA256 signature", () => {
    const signature = signPayload(payload, secret);
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("verifies a correct signature", () => {
    const signature = signPayload(payload, secret);
    expect(verifySignature(payload, secret, signature)).toBe(true);
  });

  it("rejects an incorrect signature", () => {
    expect(verifySignature(payload, secret, "sha256=invalid")).toBe(false);
  });

  it("rejects a different payload", () => {
    const signature = signPayload(payload, secret);
    expect(verifySignature("different", secret, signature)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test -- src/__tests__/webhook.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement webhook service**

```typescript
// apps/api/src/services/webhook.ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  webhookEndpoints,
  webhookDeliveries,
} from "../db/schema.js";
import { WEBHOOK_RETRY_DELAYS, WEBHOOK_MAX_RETRIES } from "@waitlist/shared";

export function signPayload(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${hmac}`;
}

export function verifySignature(
  payload: string,
  secret: string,
  signature: string
): boolean {
  const expected = signPayload(payload, secret);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export class WebhookService {
  constructor(private db: Database) {}

  async getEndpointsForEvent(projectId: string, eventType: string) {
    const endpoints = await this.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.projectId, projectId),
          eq(webhookEndpoints.active, true)
        )
      );

    return endpoints.filter((ep) => {
      const events = ep.events as string[];
      return events.includes(eventType);
    });
  }

  async recordDelivery(
    endpointId: string,
    eventType: string,
    payload: Record<string, unknown>,
    statusCode: number | null,
    responseBody: string | null,
    attempt: number
  ) {
    const shouldRetry =
      (statusCode === null || statusCode >= 500) &&
      attempt < WEBHOOK_MAX_RETRIES;

    const nextRetryAt = shouldRetry
      ? new Date(Date.now() + WEBHOOK_RETRY_DELAYS[attempt - 1]!)
      : null;

    await this.db.insert(webhookDeliveries).values({
      endpointId,
      eventType,
      payload,
      statusCode,
      responseBody,
      attempt,
      deliveredAt: statusCode !== null && statusCode < 400 ? new Date() : null,
      nextRetryAt,
    });

    return { shouldRetry, nextRetryAt };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test -- src/__tests__/webhook.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Create webhook dispatch worker**

```typescript
// apps/api/src/workers/webhook.ts
import type { Job } from "bullmq";
import type { Database } from "../db/index.js";
import { WebhookService, signPayload } from "../services/webhook.js";

interface WebhookJobData {
  eventId: string;
  projectId: string;
  type: string;
  data: Record<string, unknown>;
  endpointId?: string;
  attempt?: number;
}

export function createWebhookProcessor(db: Database) {
  const webhookService = new WebhookService(db);

  return async function processWebhook(job: Job<WebhookJobData>) {
    const { projectId, type, data, endpointId, attempt = 1 } = job.data;

    // If specific endpoint (retry), deliver to that one
    if (endpointId) {
      await deliverToEndpoint(
        db,
        webhookService,
        endpointId,
        type,
        data,
        attempt,
        job
      );
      return;
    }

    // Otherwise, fan out to all matching endpoints
    const endpoints = await webhookService.getEndpointsForEvent(
      projectId,
      type
    );

    for (const endpoint of endpoints) {
      await deliverToEndpoint(
        db,
        webhookService,
        endpoint.id,
        type,
        data,
        1,
        job
      );
    }
  };
}

async function deliverToEndpoint(
  db: Database,
  webhookService: WebhookService,
  endpointId: string,
  eventType: string,
  data: Record<string, unknown>,
  attempt: number,
  job: Job
) {
  const { webhookEndpoints } = await import("../db/schema.js");
  const { eq } = await import("drizzle-orm");

  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, endpointId))
    .limit(1);

  if (!endpoint || !endpoint.active) return;

  const payload = JSON.stringify({
    id: crypto.randomUUID(),
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
  });

  const signature = signPayload(payload, endpoint.secret);

  let statusCode: number | null = null;
  let responseBody: string | null = null;

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": eventType,
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });

    statusCode = response.status;
    responseBody = await response.text().catch(() => null);
  } catch (err) {
    responseBody = err instanceof Error ? err.message : "Unknown error";
  }

  const { shouldRetry, nextRetryAt } = await webhookService.recordDelivery(
    endpointId,
    eventType,
    data,
    statusCode,
    responseBody,
    attempt
  );

  if (shouldRetry && nextRetryAt) {
    const delay = nextRetryAt.getTime() - Date.now();
    await job.queue?.add(
      "dispatch",
      {
        ...job.data,
        endpointId,
        attempt: attempt + 1,
      },
      { delay }
    );
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/
git commit -m "feat: add webhook signing, delivery service, and dispatch worker"
```

---

### Task 9: BullMQ Workers — Analytics & Position

**Files:**
- Create: `apps/api/src/workers/analytics.ts`
- Create: `apps/api/src/workers/position.ts`
- Create: `apps/api/src/workers/index.ts`

- [ ] **Step 1: Create analytics aggregation worker**

```typescript
// apps/api/src/workers/analytics.ts
import type { Job } from "bullmq";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import type { Database } from "../db/index.js";
import {
  events,
  subscribers,
  referrals,
  analyticsDaily,
  rewardUnlocks,
} from "../db/schema.js";

interface AnalyticsJobData {
  projectId: string;
  type: string;
  timestamp: string;
}

export function createAnalyticsProcessor(db: Database) {
  return async function processAnalytics(job: Job<AnalyticsJobData>) {
    const { projectId, timestamp } = job.data;
    const date = timestamp.slice(0, 10); // YYYY-MM-DD

    // Count signups for this date
    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const [signupCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(
        and(
          eq(subscribers.projectId, projectId),
          gte(subscribers.createdAt, dayStart),
          lte(subscribers.createdAt, dayEnd)
        )
      );

    const [referralCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(
        and(
          eq(referrals.projectId, projectId),
          gte(referrals.createdAt, dayStart),
          lte(referrals.createdAt, dayEnd)
        )
      );

    const [verifiedReferralCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(
        and(
          eq(referrals.projectId, projectId),
          eq(referrals.verified, true),
          gte(referrals.createdAt, dayStart),
          lte(referrals.createdAt, dayEnd)
        )
      );

    const [unlockCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rewardUnlocks)
      .where(
        and(
          gte(rewardUnlocks.unlockedAt, dayStart),
          lte(rewardUnlocks.unlockedAt, dayEnd)
        )
      );

    const signups = Number(signupCount?.count ?? 0);
    const refs = Number(referralCount?.count ?? 0);
    const verifiedRefs = Number(verifiedReferralCount?.count ?? 0);
    const kFactor = signups > 0 ? verifiedRefs / signups : 0;

    // Upsert daily analytics
    await db
      .insert(analyticsDaily)
      .values({
        projectId,
        date,
        signups,
        referrals: refs,
        verifiedReferrals: verifiedRefs,
        kFactor: Math.round(kFactor * 100) / 100,
        rewardUnlocks: Number(unlockCount?.count ?? 0),
      })
      .onConflictDoUpdate({
        target: [analyticsDaily.projectId, analyticsDaily.date],
        set: {
          signups,
          referrals: refs,
          verifiedReferrals: verifiedRefs,
          kFactor: Math.round(kFactor * 100) / 100,
          rewardUnlocks: Number(unlockCount?.count ?? 0),
        },
      });
  };
}
```

- [ ] **Step 2: Create position recalculation worker**

```typescript
// apps/api/src/workers/position.ts
import type { Job } from "bullmq";
import type { Database } from "../db/index.js";
import { applyPositionBump } from "../services/position.js";

interface PositionJobData {
  projectId: string;
  subscriberId: string;
  bumpAmount: number;
  maxBumps?: number;
}

export function createPositionProcessor(db: Database) {
  return async function processPosition(job: Job<PositionJobData>) {
    const { projectId, subscriberId, bumpAmount, maxBumps } = job.data;
    await applyPositionBump(db, subscriberId, projectId, bumpAmount, maxBumps);
  };
}
```

- [ ] **Step 3: Create worker registration**

```typescript
// apps/api/src/workers/index.ts
import type Redis from "ioredis";
import type { Database } from "../db/index.js";
import { createWorker } from "../lib/queue.js";
import { createWebhookProcessor } from "./webhook.js";
import { createAnalyticsProcessor } from "./analytics.js";
import { createPositionProcessor } from "./position.js";

export function registerWorkers(db: Database, redis: Redis) {
  const webhookWorker = createWorker(
    "webhook",
    createWebhookProcessor(db),
    redis,
    3
  );

  const analyticsWorker = createWorker(
    "analytics",
    createAnalyticsProcessor(db),
    redis,
    1
  );

  const positionWorker = createWorker(
    "position",
    createPositionProcessor(db),
    redis,
    1
  );

  const workers = [webhookWorker, analyticsWorker, positionWorker];

  return {
    workers,
    async closeAll() {
      await Promise.all(workers.map((w) => w.close()));
    },
  };
}
```

- [ ] **Step 4: Wire workers into server.ts**

Add to `apps/api/src/server.ts`, after route registration and before graceful shutdown:

```typescript
import { registerWorkers } from "./workers/index.js";

// ... after registerRoutes(app) ...

const { closeAll: closeWorkers } = registerWorkers(db, redis);

// Update shutdown to close workers
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down gracefully...");

  const timer = setTimeout(() => {
    console.error("Shutdown timed out after 30s");
    process.exit(1);
  }, 30_000);

  try {
    await closeWorkers();
    await app.close();
    await redis.quit();
    clearTimeout(timer);
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
};
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/workers/ apps/api/src/server.ts
git commit -m "feat: add BullMQ workers for analytics, webhook dispatch, and position recalc"
```

---

## Phase 3: Admin API

### Task 10: Admin Auth & Project Setup

**Files:**
- Create: `apps/api/src/routes/admin/auth.ts`
- Create: `apps/api/src/routes/admin/project.ts`
- Create: `apps/api/src/routes/admin/index.ts`
- Modify: `apps/api/src/routes/index.ts`

- [ ] **Step 1: Create admin auth routes**

```typescript
// apps/api/src/routes/admin/auth.ts
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { adminUsers } from "../../db/schema.js";
import { createHash } from "node:crypto";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function adminAuthRoutes(app: FastifyInstance) {
  // POST /api/v1/admin/auth/setup — first-time admin creation
  app.post("/api/v1/admin/auth/setup", async (request, reply) => {
    const [existing] = await app.db
      .select()
      .from(adminUsers)
      .limit(1);

    if (existing) {
      return reply.status(409).send({ error: "Admin already set up" });
    }

    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    }

    const [admin] = await app.db
      .insert(adminUsers)
      .values({
        email: parsed.data.email,
        passwordHash: hashPassword(parsed.data.password),
      })
      .returning();

    const token = app.jwt.sign({ sub: admin.id, email: admin.email });

    return reply.status(201).send({ token });
  });

  // POST /api/v1/admin/auth/login
  app.post("/api/v1/admin/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input" });
    }

    const [admin] = await app.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, parsed.data.email))
      .limit(1);

    if (!admin || admin.passwordHash !== hashPassword(parsed.data.password)) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({ sub: admin.id, email: admin.email });

    return reply.send({ token });
  });
}
```

- [ ] **Step 2: Create project management routes**

```typescript
// apps/api/src/routes/admin/project.ts
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { projects } from "../../db/schema.js";
import { projectConfigSchema } from "@waitlist/shared";
import { generateApiKey, hashApiKey } from "../../middleware/api-key.js";
import { generateApiKey as genKey } from "../../lib/referral-code.js";
import { API_KEY_PREFIX } from "@waitlist/shared";

export async function adminProjectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/project
  app.get("/api/v1/admin/project", async (request, reply) => {
    const allProjects = await app.db.select().from(projects);

    return reply.send(
      allProjects.map((p) => ({
        id: p.id,
        name: p.name,
        mode: p.mode,
        config: p.config,
        apiKey: p.apiKey, // shown in admin only
        createdAt: p.createdAt,
      }))
    );
  });

  // POST /api/v1/admin/project
  app.post("/api/v1/admin/project", async (request, reply) => {
    const parsed = projectConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const config = parsed.data;
    const apiKey = genKey(API_KEY_PREFIX);
    const apiKeyHashed = hashApiKey(apiKey);

    const [project] = await app.db
      .insert(projects)
      .values({
        name: config.name,
        mode: config.mode,
        config,
        apiKey,
        apiKeyHash: apiKeyHashed,
      })
      .returning();

    return reply.status(201).send({
      id: project.id,
      name: project.name,
      mode: project.mode,
      apiKey,
      config,
    });
  });

  // PUT /api/v1/admin/project/:id
  app.put("/api/v1/admin/project/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = projectConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const config = parsed.data;
    const [updated] = await app.db
      .update(projects)
      .set({
        name: config.name,
        mode: config.mode,
        config,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: "Project not found" });
    }

    return reply.send({ id: updated.id, name: updated.name, config });
  });
}
```

- [ ] **Step 3: Create admin route index**

```typescript
// apps/api/src/routes/admin/index.ts
import type { FastifyInstance } from "fastify";
import { adminAuthRoutes } from "./auth.js";
import { adminProjectRoutes } from "./project.js";

export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminAuthRoutes);
  await app.register(adminProjectRoutes);
}
```

- [ ] **Step 4: Register admin routes**

Update `apps/api/src/routes/index.ts`:

```typescript
// apps/api/src/routes/index.ts
import type { FastifyInstance } from "fastify";
import { subscribeRoutes } from "./subscribe.js";
import { leaderboardRoutes } from "./leaderboard.js";
import { statsRoutes } from "./stats.js";
import { adminRoutes } from "./admin/index.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));
  await app.register(subscribeRoutes);
  await app.register(leaderboardRoutes);
  await app.register(statsRoutes);
  await app.register(adminRoutes);
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/
git commit -m "feat: add admin auth (setup/login), project CRUD endpoints"
```

---

### Task 11: Admin Subscriber, Rewards, Webhooks, Experiments Endpoints

**Files:**
- Create: `apps/api/src/routes/admin/subscribers.ts`
- Create: `apps/api/src/routes/admin/rewards.ts`
- Create: `apps/api/src/routes/admin/webhooks.ts`
- Create: `apps/api/src/routes/admin/experiments.ts`
- Modify: `apps/api/src/routes/admin/index.ts`

- [ ] **Step 1: Create admin subscribers routes**

```typescript
// apps/api/src/routes/admin/subscribers.ts
import type { FastifyInstance } from "fastify";
import { eq, and, sql, ilike, desc } from "drizzle-orm";
import { subscribers, referrals } from "../../db/schema.js";
import { paginationSchema, bulkActionSchema } from "@waitlist/shared";

export async function adminSubscribersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/subscribers?projectId=&page=&limit=&status=&search=
  app.get("/api/v1/admin/subscribers", async (request, reply) => {
    const query = request.query as any;
    const { page, limit } = paginationSchema.parse(query);
    const projectId = query.projectId as string;
    const status = query.status as string | undefined;
    const search = query.search as string | undefined;

    if (!projectId) {
      return reply.status(400).send({ error: "projectId required" });
    }

    const conditions = [eq(subscribers.projectId, projectId)];
    if (status) conditions.push(eq(subscribers.status, status));
    if (search) conditions.push(ilike(subscribers.email, `%${search}%`));

    const where = and(...conditions);
    const offset = (page - 1) * limit;

    const [countResult] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(where);

    const results = await app.db
      .select()
      .from(subscribers)
      .where(where)
      .orderBy(desc(subscribers.createdAt))
      .limit(limit)
      .offset(offset);

    return reply.send({
      data: results,
      pagination: {
        page,
        limit,
        total: Number(countResult?.count ?? 0),
      },
    });
  });

  // PATCH /api/v1/admin/subscribers/:id
  app.patch("/api/v1/admin/subscribers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: string };

    if (!["approved", "rejected", "banned"].includes(status)) {
      return reply.status(400).send({ error: "Invalid status" });
    }

    const [updated] = await app.db
      .update(subscribers)
      .set({ status, updatedAt: new Date() })
      .where(eq(subscribers.id, id))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: "Subscriber not found" });
    }

    return reply.send(updated);
  });

  // POST /api/v1/admin/subscribers/bulk
  app.post("/api/v1/admin/subscribers/bulk", async (request, reply) => {
    const parsed = bulkActionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input" });
    }

    const { ids, action } = parsed.data;
    const statusMap = { approve: "approved", reject: "rejected", ban: "banned" };
    const newStatus = statusMap[action];

    const updated = await app.db
      .update(subscribers)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(sql`${subscribers.id} = ANY(${ids})`)
      .returning();

    return reply.send({ updated: updated.length });
  });
}
```

- [ ] **Step 2: Create admin rewards routes**

```typescript
// apps/api/src/routes/admin/rewards.ts
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { rewardTiers } from "../../db/schema.js";
import { rewardTierConfigSchema } from "@waitlist/shared";
import { z } from "zod";

const createRewardSchema = rewardTierConfigSchema.extend({
  projectId: z.string().uuid(),
  sortOrder: z.number().int().default(0),
});

export async function adminRewardsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/rewards?projectId=
  app.get("/api/v1/admin/rewards", async (request, reply) => {
    const { projectId } = request.query as { projectId: string };
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const tiers = await app.db
      .select()
      .from(rewardTiers)
      .where(eq(rewardTiers.projectId, projectId));

    return reply.send(tiers);
  });

  // POST /api/v1/admin/rewards
  app.post("/api/v1/admin/rewards", async (request, reply) => {
    const parsed = createRewardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    }

    const [tier] = await app.db
      .insert(rewardTiers)
      .values(parsed.data)
      .returning();

    return reply.status(201).send(tier);
  });

  // PUT /api/v1/admin/rewards/:id
  app.put("/api/v1/admin/rewards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = rewardTierConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input" });
    }

    const [updated] = await app.db
      .update(rewardTiers)
      .set(parsed.data)
      .where(eq(rewardTiers.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return reply.send(updated);
  });

  // DELETE /api/v1/admin/rewards/:id
  app.delete("/api/v1/admin/rewards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.db.delete(rewardTiers).where(eq(rewardTiers.id, id));
    return reply.status(204).send();
  });
}
```

- [ ] **Step 3: Create admin webhooks routes**

```typescript
// apps/api/src/routes/admin/webhooks.ts
import type { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { webhookEndpoints, webhookDeliveries } from "../../db/schema.js";
import { webhookEndpointSchema, paginationSchema } from "@waitlist/shared";
import { z } from "zod";

const createWebhookSchema = webhookEndpointSchema.extend({
  projectId: z.string().uuid(),
});

export async function adminWebhooksRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/webhooks?projectId=
  app.get("/api/v1/admin/webhooks", async (request, reply) => {
    const { projectId } = request.query as { projectId: string };
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const endpoints = await app.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.projectId, projectId));

    return reply.send(endpoints);
  });

  // POST /api/v1/admin/webhooks
  app.post("/api/v1/admin/webhooks", async (request, reply) => {
    const parsed = createWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    }

    const [endpoint] = await app.db
      .insert(webhookEndpoints)
      .values(parsed.data)
      .returning();

    return reply.status(201).send(endpoint);
  });

  // DELETE /api/v1/admin/webhooks/:id
  app.delete("/api/v1/admin/webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.db.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id));
    return reply.status(204).send();
  });

  // GET /api/v1/admin/webhooks/:id/deliveries
  app.get("/api/v1/admin/webhooks/:id/deliveries", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { page, limit } = paginationSchema.parse(request.query);

    const deliveries = await app.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, id))
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    return reply.send(deliveries);
  });
}
```

- [ ] **Step 4: Create admin experiments routes**

```typescript
// apps/api/src/routes/admin/experiments.ts
import type { FastifyInstance } from "fastify";
import { eq, sql, and } from "drizzle-orm";
import {
  experiments,
  experimentAssignments,
  referrals,
  subscribers,
} from "../../db/schema.js";
import { experimentSchema } from "@waitlist/shared";
import { z } from "zod";

const createExperimentSchema = experimentSchema.extend({
  projectId: z.string().uuid(),
});

export async function adminExperimentsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/experiments?projectId=
  app.get("/api/v1/admin/experiments", async (request, reply) => {
    const { projectId } = request.query as { projectId: string };
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const exps = await app.db
      .select()
      .from(experiments)
      .where(eq(experiments.projectId, projectId));

    return reply.send(exps);
  });

  // POST /api/v1/admin/experiments
  app.post("/api/v1/admin/experiments", async (request, reply) => {
    const parsed = createExperimentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: "Invalid input", details: parsed.error.flatten().fieldErrors });
    }

    const [exp] = await app.db
      .insert(experiments)
      .values(parsed.data)
      .returning();

    return reply.status(201).send(exp);
  });

  // PATCH /api/v1/admin/experiments/:id (activate/deactivate)
  app.patch("/api/v1/admin/experiments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { active } = request.body as { active: boolean };

    const [updated] = await app.db
      .update(experiments)
      .set({ active })
      .where(eq(experiments.id, id))
      .returning();

    if (!updated) return reply.status(404).send({ error: "Not found" });
    return reply.send(updated);
  });

  // DELETE /api/v1/admin/experiments/:id
  app.delete("/api/v1/admin/experiments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    await app.db.delete(experiments).where(eq(experiments.id, id));
    return reply.status(204).send();
  });
}
```

- [ ] **Step 5: Update admin route index**

```typescript
// apps/api/src/routes/admin/index.ts
import type { FastifyInstance } from "fastify";
import { adminAuthRoutes } from "./auth.js";
import { adminProjectRoutes } from "./project.js";
import { adminSubscribersRoutes } from "./subscribers.js";
import { adminRewardsRoutes } from "./rewards.js";
import { adminWebhooksRoutes } from "./webhooks.js";
import { adminExperimentsRoutes } from "./experiments.js";

export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminAuthRoutes);
  await app.register(adminProjectRoutes);
  await app.register(adminSubscribersRoutes);
  await app.register(adminRewardsRoutes);
  await app.register(adminWebhooksRoutes);
  await app.register(adminExperimentsRoutes);
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/admin/
git commit -m "feat: add admin endpoints for subscribers, rewards, webhooks, experiments"
```

---

### Task 12: Admin Analytics Endpoints

**Files:**
- Create: `apps/api/src/routes/admin/analytics.ts`
- Modify: `apps/api/src/routes/admin/index.ts`

- [ ] **Step 1: Create analytics routes**

```typescript
// apps/api/src/routes/admin/analytics.ts
import type { FastifyInstance } from "fastify";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import {
  subscribers,
  referrals,
  analyticsDaily,
  analyticsCohorts,
  rewardUnlocks,
} from "../../db/schema.js";
import { timeRangeSchema } from "@waitlist/shared";
import { ANALYTICS_CACHE_TTL } from "@waitlist/shared";

export async function adminAnalyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/analytics/overview?projectId=
  app.get("/api/v1/admin/analytics/overview", async (request, reply) => {
    const { projectId } = request.query as { projectId: string };
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const cacheKey = `admin:analytics:overview:${projectId}`;
    const cached = await app.redis.get(cacheKey);
    if (cached) return reply.send(JSON.parse(cached));

    const today = new Date().toISOString().slice(0, 10);
    const todayStart = new Date(`${today}T00:00:00Z`);

    const [totalSignups] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(eq(subscribers.projectId, projectId));

    const [todaySignups] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(
        and(
          eq(subscribers.projectId, projectId),
          gte(subscribers.createdAt, todayStart)
        )
      );

    const [totalReferrals] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(eq(referrals.projectId, projectId));

    const [todayReferrals] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(
        and(
          eq(referrals.projectId, projectId),
          gte(referrals.createdAt, todayStart)
        )
      );

    const total = Number(totalSignups?.count ?? 0);
    const totalRefs = Number(totalReferrals?.count ?? 0);
    const conversionRate = totalRefs > 0 && total > 0 ? totalRefs / total : 0;
    const kFactor = total > 0 ? totalRefs / total : 0;

    const overview = {
      totalSignups: total,
      todaySignups: Number(todaySignups?.count ?? 0),
      totalReferrals: totalRefs,
      todayReferrals: Number(todayReferrals?.count ?? 0),
      conversionRate: Math.round(conversionRate * 10000) / 100,
      kFactor: Math.round(kFactor * 100) / 100,
    };

    await app.redis.setex(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(overview));
    return reply.send(overview);
  });

  // GET /api/v1/admin/analytics/timeseries?projectId=&from=&to=
  app.get("/api/v1/admin/analytics/timeseries", async (request, reply) => {
    const { projectId } = request.query as { projectId: string };
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const parsed = timeRangeSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: "from and to dates required" });
    }

    const fromDate = parsed.data.from.toISOString().slice(0, 10);
    const toDate = parsed.data.to.toISOString().slice(0, 10);

    const data = await app.db
      .select()
      .from(analyticsDaily)
      .where(
        and(
          eq(analyticsDaily.projectId, projectId),
          gte(analyticsDaily.date, fromDate),
          lte(analyticsDaily.date, toDate)
        )
      )
      .orderBy(analyticsDaily.date);

    return reply.send(
      data.map((d) => ({
        date: d.date,
        signups: d.signups,
        referrals: d.referrals,
        kFactor: d.kFactor,
      }))
    );
  });

  // GET /api/v1/admin/analytics/cohorts?projectId=
  app.get("/api/v1/admin/analytics/cohorts", async (request, reply) => {
    const { projectId } = request.query as { projectId: string };
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const data = await app.db
      .select()
      .from(analyticsCohorts)
      .where(eq(analyticsCohorts.projectId, projectId))
      .orderBy(desc(analyticsCohorts.cohortWeek));

    return reply.send(data);
  });

  // GET /api/v1/admin/analytics/channels?projectId=
  app.get("/api/v1/admin/analytics/channels", async (request, reply) => {
    const { projectId } = request.query as { projectId: string };
    if (!projectId) return reply.status(400).send({ error: "projectId required" });

    const data = await app.db
      .select({
        channel: referrals.channel,
        signups: sql<number>`count(*)`,
      })
      .from(referrals)
      .where(eq(referrals.projectId, projectId))
      .groupBy(referrals.channel);

    const totalReferrals = data.reduce((sum, d) => sum + Number(d.signups), 0);

    return reply.send(
      data.map((d) => ({
        channel: d.channel ?? "direct",
        clicks: 0, // would need a separate clicks table
        signups: Number(d.signups),
        conversionRate:
          totalReferrals > 0
            ? Math.round((Number(d.signups) / totalReferrals) * 10000) / 100
            : 0,
      }))
    );
  });
}
```

- [ ] **Step 2: Register in admin index**

Add `import { adminAnalyticsRoutes } from "./analytics.js";` and `await app.register(adminAnalyticsRoutes);` to `apps/api/src/routes/admin/index.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/admin/
git commit -m "feat: add admin analytics endpoints (overview, timeseries, cohorts, channels)"
```

---

## Phase 4: SDK & Widget Packages

### Task 13: Headless SDK (`@waitlist/sdk`)

**Files:**
- Create: `packages/sdk/package.json`
- Create: `packages/sdk/tsconfig.json`
- Create: `packages/sdk/src/client.ts`
- Create: `packages/sdk/src/index.ts`
- Create: `packages/sdk/src/__tests__/client.test.ts`

- [ ] **Step 1: Create package scaffolding**

```json
// packages/sdk/package.json
{
  "name": "@waitlist/sdk",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run"
  },
  "dependencies": {
    "@waitlist/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

```json
// packages/sdk/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["src/**/__tests__/**", "**/*.test.ts"]
}
```

- [ ] **Step 2: Write failing test for SDK client**

```typescript
// packages/sdk/src/__tests__/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WaitlistClient } from "../client.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("WaitlistClient", () => {
  let client: WaitlistClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new WaitlistClient({
      apiKey: "wl_pk_test123",
      baseUrl: "http://localhost:3400",
    });
  });

  it("sends subscribe request with correct headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "sub-1",
          email: "test@example.com",
          position: 1,
          referralCode: "abc12345",
          status: "waiting",
          totalSignups: 1,
        }),
    });

    const result = await client.subscribe({ email: "test@example.com" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3400/api/v1/subscribe",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-API-Key": "wl_pk_test123",
        }),
      })
    );
    expect(result.referralCode).toBe("abc12345");
  });

  it("sends status request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          position: 5,
          referralCount: 3,
          referralCode: "abc12345",
          rewards: ["early_access"],
          status: "waiting",
        }),
    });

    const status = await client.getStatus("test@example.com");
    expect(status.referralCount).toBe(3);
    expect(status.rewards).toContain("early_access");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: "Invalid API key" }),
    });

    await expect(
      client.subscribe({ email: "test@example.com" })
    ).rejects.toThrow("Invalid API key");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/sdk && pnpm test`
Expected: FAIL — module not found

- [ ] **Step 4: Implement SDK client**

```typescript
// packages/sdk/src/client.ts
import type {
  SubscribeRequest,
  SubscribeResponse,
  SubscriberStatusResponse,
  LeaderboardEntry,
  PublicStats,
} from "@waitlist/shared";

export interface WaitlistClientOptions {
  apiKey: string;
  baseUrl: string;
}

export class WaitlistClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: WaitlistClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": this.apiKey,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? `HTTP ${response.status}`);
    }

    return data as T;
  }

  async subscribe(
    input: Omit<SubscribeRequest, "ip">
  ): Promise<SubscribeResponse> {
    return this.request<SubscribeResponse>("/api/v1/subscribe", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async getStatus(email: string): Promise<SubscriberStatusResponse> {
    return this.request<SubscriberStatusResponse>(
      `/api/v1/subscribe/${encodeURIComponent(email)}/status`
    );
  }

  async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
    return this.request<LeaderboardEntry[]>(
      `/api/v1/leaderboard?limit=${limit}`
    );
  }

  async getStats(): Promise<PublicStats> {
    return this.request<PublicStats>("/api/v1/stats");
  }
}
```

```typescript
// packages/sdk/src/index.ts
export { WaitlistClient, type WaitlistClientOptions } from "./client.js";
export type {
  SubscribeRequest,
  SubscribeResponse,
  SubscriberStatusResponse,
  LeaderboardEntry,
  PublicStats,
} from "@waitlist/shared";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/sdk && pnpm test`
Expected: All 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add packages/sdk/
git commit -m "feat: add @waitlist/sdk headless client package"
```

---

### Task 14: Drop-in Widget (`@waitlist/widget`)

**Files:**
- Create: `packages/widget/package.json`
- Create: `packages/widget/tsconfig.json`
- Create: `packages/widget/src/widget.ts`
- Create: `packages/widget/src/styles.ts`
- Create: `packages/widget/src/index.ts`
- Create: `packages/widget/vite.config.ts`

- [ ] **Step 1: Create package scaffolding**

```json
// packages/widget/package.json
{
  "name": "@waitlist/widget",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/waitlist-widget.umd.js",
  "module": "dist/waitlist-widget.es.js",
  "exports": {
    ".": {
      "import": "./dist/waitlist-widget.es.js",
      "require": "./dist/waitlist-widget.umd.js"
    }
  },
  "scripts": {
    "build": "vite build",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@waitlist/sdk": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

```json
// packages/widget/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts"]
}
```

```typescript
// packages/widget/vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/index.ts",
      name: "WaitlistWidget",
      fileName: "waitlist-widget",
      formats: ["es", "umd"],
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
```

- [ ] **Step 2: Create widget styles**

```typescript
// packages/widget/src/styles.ts
export function getStyles(accent: string, theme: "light" | "dark"): string {
  const bg = theme === "dark" ? "#1a1a2e" : "#ffffff";
  const text = theme === "dark" ? "#e0e0e0" : "#1a1a2e";
  const border = theme === "dark" ? "#333" : "#e0e0e0";
  const inputBg = theme === "dark" ? "#16213e" : "#f5f5f5";

  return `
    .wl-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 420px;
      background: ${bg};
      color: ${text};
      border: 1px solid ${border};
      border-radius: 12px;
      padding: 24px;
      box-sizing: border-box;
    }
    .wl-title { font-size: 20px; font-weight: 600; margin: 0 0 8px; }
    .wl-subtitle { font-size: 14px; opacity: 0.7; margin: 0 0 16px; }
    .wl-form { display: flex; flex-direction: column; gap: 10px; }
    .wl-input {
      padding: 10px 14px;
      border: 1px solid ${border};
      border-radius: 8px;
      background: ${inputBg};
      color: ${text};
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .wl-input:focus { border-color: ${accent}; }
    .wl-button {
      padding: 10px 14px;
      background: ${accent};
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .wl-button:hover { opacity: 0.9; }
    .wl-button:disabled { opacity: 0.5; cursor: not-allowed; }
    .wl-success {
      text-align: center;
      padding: 16px 0;
    }
    .wl-position { font-size: 32px; font-weight: 700; color: ${accent}; }
    .wl-referral { font-size: 12px; opacity: 0.6; margin-top: 12px; word-break: break-all; }
    .wl-referral-link {
      display: block;
      padding: 8px;
      background: ${inputBg};
      border-radius: 6px;
      margin-top: 4px;
      font-family: monospace;
      font-size: 13px;
      cursor: pointer;
    }
    .wl-error { color: #ff4444; font-size: 13px; margin-top: 4px; }
  `;
}
```

- [ ] **Step 3: Create widget logic**

```typescript
// packages/widget/src/widget.ts
import { WaitlistClient } from "@waitlist/sdk";
import { getStyles } from "./styles.js";

interface WidgetConfig {
  apiKey: string;
  apiUrl: string;
  theme?: "light" | "dark";
  accent?: string;
  title?: string;
  subtitle?: string;
  buttonText?: string;
  container?: HTMLElement;
}

export function mountWidget(config: WidgetConfig) {
  const {
    apiKey,
    apiUrl,
    theme = "light",
    accent = "#4a9eff",
    title = "Join the Waitlist",
    subtitle = "Be the first to know when we launch.",
    buttonText = "Join Now",
    container,
  } = config;

  const client = new WaitlistClient({ apiKey, baseUrl: apiUrl });

  const root = container ?? document.createElement("div");
  if (!container) document.body.appendChild(root);

  const shadow = root.attachShadow({ mode: "open" });

  const style = document.createElement("style");
  style.textContent = getStyles(accent, theme);
  shadow.appendChild(style);

  const wrapper = document.createElement("div");
  wrapper.className = "wl-container";
  shadow.appendChild(wrapper);

  // Render form
  renderForm();

  function renderForm() {
    wrapper.innerHTML = `
      <div class="wl-title">${title}</div>
      <div class="wl-subtitle">${subtitle}</div>
      <form class="wl-form">
        <input class="wl-input" type="email" placeholder="Your email" required />
        <input class="wl-input" type="text" placeholder="Your name (optional)" />
        <button class="wl-button" type="submit">${buttonText}</button>
      </form>
      <div class="wl-error" style="display:none"></div>
    `;

    const form = shadow.querySelector("form")!;
    const errorEl = shadow.querySelector(".wl-error") as HTMLElement;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputs = shadow.querySelectorAll("input") as NodeListOf<HTMLInputElement>;
      const email = inputs[0]!.value;
      const name = inputs[1]!.value || undefined;
      const button = shadow.querySelector("button") as HTMLButtonElement;

      // Get referral code from URL
      const url = new URL(window.location.href);
      const referralCode = url.searchParams.get("ref") ?? undefined;

      button.disabled = true;
      button.textContent = "Joining...";
      errorEl.style.display = "none";

      try {
        const result = await client.subscribe({ email, name, referralCode });
        renderSuccess(result.position, result.referralCode);
      } catch (err) {
        errorEl.textContent = err instanceof Error ? err.message : "Something went wrong";
        errorEl.style.display = "block";
        button.disabled = false;
        button.textContent = buttonText;
      }
    });
  }

  function renderSuccess(position: number | null, referralCode: string) {
    const referralUrl = `${window.location.origin}${window.location.pathname}?ref=${referralCode}`;

    wrapper.innerHTML = `
      <div class="wl-success">
        <div class="wl-title">You're in! 🎉</div>
        ${position !== null ? `<div class="wl-position">#${position}</div><div class="wl-subtitle">Your position on the waitlist</div>` : '<div class="wl-subtitle">We\'ll be in touch soon.</div>'}
        <div class="wl-referral">
          Share to move up:
          <span class="wl-referral-link" title="Click to copy">${referralUrl}</span>
        </div>
      </div>
    `;

    const link = shadow.querySelector(".wl-referral-link");
    link?.addEventListener("click", () => {
      navigator.clipboard.writeText(referralUrl).then(() => {
        if (link) link.textContent = "Copied!";
        setTimeout(() => {
          if (link) link.textContent = referralUrl;
        }, 2000);
      });
    });
  }
}
```

- [ ] **Step 4: Create index with auto-init**

```typescript
// packages/widget/src/index.ts
import { mountWidget } from "./widget.js";

export { mountWidget };

// Auto-init from script tag attributes
if (typeof document !== "undefined") {
  const script = document.currentScript as HTMLScriptElement | null;
  if (script) {
    const apiKey = script.getAttribute("data-api-key");
    const apiUrl = script.getAttribute("data-api-url");

    if (apiKey && apiUrl) {
      const ready = () =>
        mountWidget({
          apiKey,
          apiUrl,
          theme: (script.getAttribute("data-theme") as "light" | "dark") ?? "light",
          accent: script.getAttribute("data-accent") ?? "#4a9eff",
          title: script.getAttribute("data-title") ?? undefined,
          subtitle: script.getAttribute("data-subtitle") ?? undefined,
          buttonText: script.getAttribute("data-button-text") ?? undefined,
        });

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ready);
      } else {
        ready();
      }
    }
  }
}
```

- [ ] **Step 5: Build and verify**

Run: `pnpm install && pnpm build --filter=@waitlist/widget`
Expected: `packages/widget/dist/waitlist-widget.es.js` and `.umd.js` created

- [ ] **Step 6: Commit**

```bash
git add packages/widget/
git commit -m "feat: add @waitlist/widget drop-in embeddable script"
```

---

### Task 15: React Components (`@waitlist/react`)

**Files:**
- Create: `packages/react/package.json`
- Create: `packages/react/tsconfig.json`
- Create: `packages/react/src/WaitlistProvider.tsx`
- Create: `packages/react/src/WaitlistForm.tsx`
- Create: `packages/react/src/ReferralStatus.tsx`
- Create: `packages/react/src/index.ts`

- [ ] **Step 1: Create package scaffolding**

```json
// packages/react/package.json
{
  "name": "@waitlist/react",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@waitlist/sdk": "workspace:*"
  },
  "peerDependencies": {
    "react": ">=18.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "react": "^19.0.0"
  }
}
```

```json
// packages/react/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts", "**/*.test.tsx"]
}
```

- [ ] **Step 2: Create WaitlistProvider**

```tsx
// packages/react/src/WaitlistProvider.tsx
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { WaitlistClient } from "@waitlist/sdk";

interface WaitlistContextValue {
  client: WaitlistClient;
}

const WaitlistContext = createContext<WaitlistContextValue | null>(null);

export function useWaitlistClient(): WaitlistClient {
  const ctx = useContext(WaitlistContext);
  if (!ctx) throw new Error("useWaitlistClient must be used within WaitlistProvider");
  return ctx.client;
}

interface WaitlistProviderProps {
  apiKey: string;
  baseUrl: string;
  children: ReactNode;
}

export function WaitlistProvider({ apiKey, baseUrl, children }: WaitlistProviderProps) {
  const client = useMemo(
    () => new WaitlistClient({ apiKey, baseUrl }),
    [apiKey, baseUrl]
  );

  return (
    <WaitlistContext.Provider value={{ client }}>
      {children}
    </WaitlistContext.Provider>
  );
}
```

- [ ] **Step 3: Create WaitlistForm**

```tsx
// packages/react/src/WaitlistForm.tsx
import { useState, type FormEvent } from "react";
import { WaitlistClient, type SubscribeResponse } from "@waitlist/sdk";
import { useWaitlistClient } from "./WaitlistProvider.js";

interface WaitlistFormProps {
  apiKey?: string;
  baseUrl?: string;
  onSuccess?: (result: SubscribeResponse) => void;
  onError?: (error: Error) => void;
  className?: string;
  referralCode?: string;
}

export function WaitlistForm({
  apiKey,
  baseUrl,
  onSuccess,
  onError,
  className,
  referralCode,
}: WaitlistFormProps) {
  let client: WaitlistClient;
  try {
    client = useWaitlistClient();
  } catch {
    if (!apiKey || !baseUrl) throw new Error("Provide apiKey + baseUrl or use WaitlistProvider");
    client = new WaitlistClient({ apiKey, baseUrl });
  }

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubscribeResponse | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await client.subscribe({ email, name: name || undefined, referralCode });
      setResult(res);
      onSuccess?.(res);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      onError?.(err instanceof Error ? err : new Error(msg));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className={className}>
        <h3>You're in!</h3>
        {result.position !== null && <p>Your position: #{result.position}</p>}
        <p>Your referral code: <code>{result.referralCode}</code></p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <input
        type="email"
        placeholder="Your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="text"
        placeholder="Your name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? "Joining..." : "Join Waitlist"}
      </button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 4: Create ReferralStatus**

```tsx
// packages/react/src/ReferralStatus.tsx
import { useEffect, useState } from "react";
import { WaitlistClient, type SubscriberStatusResponse } from "@waitlist/sdk";
import { useWaitlistClient } from "./WaitlistProvider.js";

interface ReferralStatusProps {
  email: string;
  apiKey?: string;
  baseUrl?: string;
  className?: string;
}

export function ReferralStatus({ email, apiKey, baseUrl, className }: ReferralStatusProps) {
  let client: WaitlistClient;
  try {
    client = useWaitlistClient();
  } catch {
    if (!apiKey || !baseUrl) throw new Error("Provide apiKey + baseUrl or use WaitlistProvider");
    client = new WaitlistClient({ apiKey, baseUrl });
  }

  const [status, setStatus] = useState<SubscriberStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    client.getStatus(email).then(setStatus).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load status");
    });
  }, [email]);

  if (error) return <div className={className}>Error: {error}</div>;
  if (!status) return <div className={className}>Loading...</div>;

  return (
    <div className={className}>
      {status.position !== null && <p>Position: #{status.position}</p>}
      <p>Referrals: {status.referralCount}</p>
      <p>Status: {status.status}</p>
      {status.rewards.length > 0 && (
        <p>Rewards: {status.rewards.join(", ")}</p>
      )}
      <p>Your referral code: <code>{status.referralCode}</code></p>
    </div>
  );
}
```

- [ ] **Step 5: Create index**

```typescript
// packages/react/src/index.ts
export { WaitlistProvider, useWaitlistClient } from "./WaitlistProvider.js";
export { WaitlistForm } from "./WaitlistForm.js";
export { ReferralStatus } from "./ReferralStatus.js";
```

- [ ] **Step 6: Build and verify**

Run: `pnpm install && pnpm build --filter=@waitlist/react`
Expected: Successful build with `.js` and `.d.ts` files in `packages/react/dist/`

- [ ] **Step 7: Commit**

```bash
git add packages/react/
git commit -m "feat: add @waitlist/react components (WaitlistForm, ReferralStatus, Provider)"
```

---

## Phase 5: Admin Dashboard

### Task 16: Admin Dashboard Scaffolding

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/vite.config.ts`
- Create: `apps/admin/index.html`
- Create: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/App.tsx`
- Create: `apps/admin/src/lib/api.ts`
- Create: `apps/admin/src/routes.tsx`
- Create: `apps/admin/tailwind.config.ts`
- Create: `apps/admin/postcss.config.js`
- Create: `apps/admin/src/index.css`

- [ ] **Step 1: Create package.json and configs**

```json
// apps/admin/package.json
{
  "name": "@waitlist/admin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.95.0",
    "@tanstack/react-query": "^5.62.0",
    "@tanstack/react-table": "^8.20.0",
    "recharts": "^2.15.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.0",
    "vite": "^6.0.0"
  }
}
```

```typescript
// apps/admin/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
```

```json
// apps/admin/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Create index.html and entry point**

```html
<!-- apps/admin/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Waitlist Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```tsx
// apps/admin/src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App.js";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
```

```css
/* apps/admin/src/index.css */
@import "tailwindcss";
```

- [ ] **Step 3: Create API client**

```typescript
// apps/admin/src/lib/api.ts
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3400";

function getToken(): string | null {
  return localStorage.getItem("admin_token");
}

export function setToken(token: string) {
  localStorage.setItem("admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("admin_token");
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
```

- [ ] **Step 4: Create App shell with routing**

```tsx
// apps/admin/src/App.tsx
import { useState, useEffect } from "react";
import { api, setToken, clearToken } from "./lib/api.js";

export function App() {
  const [token, setTokenState] = useState(localStorage.getItem("admin_token"));
  const [page, setPage] = useState("overview");

  if (!token) {
    return <LoginPage onLogin={(t) => { setToken(t); setTokenState(t); }} />;
  }

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      <Sidebar page={page} onNavigate={setPage} onLogout={() => { clearToken(); setTokenState(null); }} />
      <main className="flex-1 overflow-auto p-6">
        {page === "overview" && <div>Overview — coming in next task</div>}
        {page === "subscribers" && <div>Subscribers — coming in next task</div>}
        {page === "rewards" && <div>Rewards — coming in next task</div>}
        {page === "experiments" && <div>Experiments — coming in next task</div>}
        {page === "webhooks" && <div>Webhooks — coming in next task</div>}
        {page === "settings" && <div>Settings — coming in next task</div>}
      </main>
    </div>
  );
}

function Sidebar({ page, onNavigate, onLogout }: { page: string; onNavigate: (p: string) => void; onLogout: () => void }) {
  const items = [
    { key: "overview", label: "Overview" },
    { key: "subscribers", label: "Subscribers" },
    { key: "rewards", label: "Rewards" },
    { key: "experiments", label: "Experiments" },
    { key: "webhooks", label: "Webhooks" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      <div className="p-4 text-lg font-bold border-b border-gray-800">Waitlist Admin</div>
      <nav className="flex-1 p-2">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => onNavigate(item.key)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 ${
              page === item.key ? "bg-gray-800 text-white" : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="p-2 border-t border-gray-800">
        <button onClick={onLogout} className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white">Logout</button>
      </div>
    </aside>
  );
}

function LoginPage({ onLogin }: { onLogin: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSetup, setIsSetup] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const endpoint = isSetup ? "/api/v1/admin/auth/setup" : "/api/v1/admin/auth/login";
      const res = await api<{ token: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      onLogin(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <form onSubmit={handleSubmit} className="bg-gray-900 p-8 rounded-xl border border-gray-800 w-96">
        <h1 className="text-xl font-bold text-white mb-6">{isSetup ? "Setup Admin" : "Login"}</h1>
        <input
          type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full mb-3 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          required
        />
        <input
          type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
          className="w-full mb-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
          required
        />
        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500">
          {isSetup ? "Create Admin" : "Login"}
        </button>
        <button type="button" onClick={() => setIsSetup(!isSetup)} className="w-full mt-3 text-sm text-gray-400 hover:text-white">
          {isSetup ? "Already set up? Login" : "First time? Setup admin"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Install dependencies and verify dev server**

Run: `pnpm install && cd apps/admin && pnpm dev`
Expected: Vite dev server at http://localhost:5173 showing the login page

- [ ] **Step 6: Commit**

```bash
git add apps/admin/
git commit -m "feat: scaffold admin dashboard with login, sidebar, and routing shell"
```

---

### Task 17: Admin Dashboard Pages

**Files:**
- Create: `apps/admin/src/pages/Overview.tsx`
- Create: `apps/admin/src/pages/Subscribers.tsx`
- Create: `apps/admin/src/pages/Rewards.tsx`
- Create: `apps/admin/src/pages/Experiments.tsx`
- Create: `apps/admin/src/pages/Webhooks.tsx`
- Create: `apps/admin/src/pages/Settings.tsx`
- Modify: `apps/admin/src/App.tsx`

- [ ] **Step 1: Create Overview page**

```tsx
// apps/admin/src/pages/Overview.tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { AnalyticsOverview, TimeseriesPoint } from "@waitlist/shared";

export function Overview({ projectId }: { projectId: string }) {
  const { data: overview } = useQuery({
    queryKey: ["analytics", "overview", projectId],
    queryFn: () => api<AnalyticsOverview>(`/api/v1/admin/analytics/overview?projectId=${projectId}`),
    refetchInterval: 30_000,
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: timeseries } = useQuery({
    queryKey: ["analytics", "timeseries", projectId],
    queryFn: () =>
      api<TimeseriesPoint[]>(
        `/api/v1/admin/analytics/timeseries?projectId=${projectId}&from=${thirtyDaysAgo}&to=${today}`
      ),
  });

  if (!overview) return <div>Loading...</div>;

  const cards = [
    { label: "Total Signups", value: overview.totalSignups },
    { label: "Today", value: overview.todaySignups },
    { label: "Total Referrals", value: overview.totalReferrals },
    { label: "K-Factor", value: overview.kFactor.toFixed(2) },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Overview</h2>
      <div className="grid grid-cols-4 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-sm text-gray-400">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
      {timeseries && timeseries.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">Signups & Referrals (30 days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeseries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="date" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} />
              <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333" }} />
              <Line type="monotone" dataKey="signups" stroke="#4a9eff" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="referrals" stroke="#6bcb77" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create Subscribers page**

```tsx
// apps/admin/src/pages/Subscribers.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function Subscribers({ projectId }: { projectId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["subscribers", projectId, page, search, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams({ projectId, page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      return api<{ data: any[]; pagination: any }>(`/api/v1/admin/subscribers?${params}`);
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/v1/admin/subscribers/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subscribers"] }),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Subscribers</h2>
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Search by email..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white"
        >
          <option value="">All statuses</option>
          <option value="waiting">Waiting</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="active">Active</option>
        </select>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Position</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Joined</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((sub: any) => (
              <tr key={sub.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-3">{sub.email}</td>
                <td className="p-3">{sub.name ?? "—"}</td>
                <td className="p-3">{sub.position ?? "—"}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded text-xs ${
                    sub.status === "approved" ? "bg-green-900 text-green-300" :
                    sub.status === "rejected" ? "bg-red-900 text-red-300" :
                    "bg-gray-800 text-gray-300"
                  }`}>{sub.status}</span>
                </td>
                <td className="p-3 text-gray-400">{new Date(sub.createdAt).toLocaleDateString()}</td>
                <td className="p-3 flex gap-2">
                  <button onClick={() => updateStatus.mutate({ id: sub.id, status: "approved" })}
                    className="text-xs px-2 py-1 bg-green-900/50 text-green-300 rounded hover:bg-green-900">Approve</button>
                  <button onClick={() => updateStatus.mutate({ id: sub.id, status: "rejected" })}
                    className="text-xs px-2 py-1 bg-red-900/50 text-red-300 rounded hover:bg-red-900">Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.pagination && (
        <div className="flex justify-between items-center mt-4 text-sm text-gray-400">
          <span>Total: {data.pagination.total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1 bg-gray-900 border border-gray-800 rounded disabled:opacity-30">Prev</button>
            <span className="px-3 py-1">Page {page}</span>
            <button onClick={() => setPage(p => p + 1)}
              disabled={page * 20 >= data.pagination.total}
              className="px-3 py-1 bg-gray-900 border border-gray-800 rounded disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create remaining pages (Rewards, Experiments, Webhooks, Settings)**

```tsx
// apps/admin/src/pages/Rewards.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api.js";

export function Rewards({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: tiers } = useQuery({
    queryKey: ["rewards", projectId],
    queryFn: () => api<any[]>(`/api/v1/admin/rewards?projectId=${projectId}`),
  });

  const deleteTier = useMutation({
    mutationFn: (id: string) => api(`/api/v1/admin/rewards/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rewards"] }),
  });

  const createTier = useMutation({
    mutationFn: (data: any) => api("/api/v1/admin/rewards", { method: "POST", body: JSON.stringify({ ...data, projectId }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rewards"] }); setShowForm(false); },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Reward Tiers</h2>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
          {showForm ? "Cancel" : "Add Tier"}
        </button>
      </div>
      {showForm && <TierForm onSubmit={(data) => createTier.mutate(data)} />}
      <div className="space-y-3">
        {tiers?.map((tier: any) => (
          <div key={tier.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex justify-between items-center">
            <div>
              <div className="font-semibold">{tier.name}</div>
              <div className="text-sm text-gray-400">
                {tier.threshold} referrals → {tier.rewardType}: {tier.rewardValue}
              </div>
            </div>
            <button onClick={() => deleteTier.mutate(tier.id)} className="text-red-400 text-sm hover:text-red-300">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TierForm({ onSubmit }: { onSubmit: (data: any) => void }) {
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState("");
  const [rewardType, setRewardType] = useState("flag");
  const [rewardValue, setRewardValue] = useState("");

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 grid grid-cols-5 gap-3">
      <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)}
        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
      <input placeholder="Threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)}
        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
      <select value={rewardType} onChange={(e) => setRewardType(e.target.value)}
        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white">
        <option value="flag">Flag</option>
        <option value="code">Code</option>
        <option value="custom">Custom</option>
      </select>
      <input placeholder="Value" value={rewardValue} onChange={(e) => setRewardValue(e.target.value)}
        className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white" />
      <button onClick={() => onSubmit({ name, threshold: Number(threshold), rewardType, rewardValue })}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg">Create</button>
    </div>
  );
}
```

```tsx
// apps/admin/src/pages/Experiments.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function Experiments({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();

  const { data: experiments } = useQuery({
    queryKey: ["experiments", projectId],
    queryFn: () => api<any[]>(`/api/v1/admin/experiments?projectId=${projectId}`),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/api/v1/admin/experiments/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["experiments"] }),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">A/B Experiments</h2>
      <div className="space-y-3">
        {experiments?.map((exp: any) => (
          <div key={exp.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold">{exp.name}</div>
                <div className="text-sm text-gray-400 mt-1">
                  Variants: {(exp.variants as any[]).map((v: any) => `${v.name} (${v.weight}%)`).join(", ")}
                </div>
              </div>
              <button
                onClick={() => toggleActive.mutate({ id: exp.id, active: !exp.active })}
                className={`px-3 py-1 rounded text-xs ${exp.active ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}
              >
                {exp.active ? "Active" : "Inactive"}
              </button>
            </div>
          </div>
        ))}
        {experiments?.length === 0 && <p className="text-gray-400">No experiments yet.</p>}
      </div>
    </div>
  );
}
```

```tsx
// apps/admin/src/pages/Webhooks.tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../lib/api.js";

export function Webhooks({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: endpoints } = useQuery({
    queryKey: ["webhooks", projectId],
    queryFn: () => api<any[]>(`/api/v1/admin/webhooks?projectId=${projectId}`),
  });

  const { data: deliveries } = useQuery({
    queryKey: ["webhook-deliveries", expandedId],
    queryFn: () => api<any[]>(`/api/v1/admin/webhooks/${expandedId}/deliveries?page=1&limit=10`),
    enabled: !!expandedId,
  });

  const deleteEndpoint = useMutation({
    mutationFn: (id: string) => api(`/api/v1/admin/webhooks/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webhooks"] }),
  });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Webhook Endpoints</h2>
      <div className="space-y-3">
        {endpoints?.map((ep: any) => (
          <div key={ep.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-mono text-sm">{ep.url}</div>
                <div className="text-xs text-gray-400 mt-1">Events: {(ep.events as string[]).join(", ")}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setExpandedId(expandedId === ep.id ? null : ep.id)}
                  className="text-xs px-2 py-1 bg-gray-800 rounded text-gray-300">Deliveries</button>
                <button onClick={() => deleteEndpoint.mutate(ep.id)}
                  className="text-xs px-2 py-1 text-red-400 hover:text-red-300">Delete</button>
              </div>
            </div>
            {expandedId === ep.id && deliveries && (
              <div className="mt-3 border-t border-gray-800 pt-3">
                {deliveries.map((d: any) => (
                  <div key={d.id} className="flex justify-between text-xs py-1 text-gray-400">
                    <span>{d.eventType}</span>
                    <span className={d.statusCode && d.statusCode < 400 ? "text-green-400" : "text-red-400"}>
                      {d.statusCode ?? "Failed"} (attempt {d.attempt})
                    </span>
                    <span>{new Date(d.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

```tsx
// apps/admin/src/pages/Settings.tsx
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

export function Settings({ projectId, onProjectChange }: { projectId: string; onProjectChange: (id: string) => void }) {
  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<any[]>("/api/v1/admin/project"),
  });

  const current = projects?.find((p: any) => p.id === projectId);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="font-semibold mb-3">Project</h3>
        <select value={projectId} onChange={(e) => onProjectChange(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white mb-4">
          {projects?.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name} ({p.mode})</option>
          ))}
        </select>
        {current && (
          <div className="mt-4 space-y-2 text-sm">
            <div><span className="text-gray-400">Mode:</span> {current.mode}</div>
            <div><span className="text-gray-400">API Key:</span> <code className="bg-gray-800 px-2 py-1 rounded">{current.apiKey}</code></div>
            <div><span className="text-gray-400">Created:</span> {new Date(current.createdAt).toLocaleDateString()}</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update App.tsx to use pages**

Replace the placeholder page rendering in `apps/admin/src/App.tsx` main area with:

```tsx
import { Overview } from "./pages/Overview.js";
import { Subscribers } from "./pages/Subscribers.js";
import { Rewards } from "./pages/Rewards.js";
import { Experiments } from "./pages/Experiments.js";
import { Webhooks } from "./pages/Webhooks.js";
import { Settings } from "./pages/Settings.js";
```

And in the App component, add `projectId` state:

```tsx
const [projectId, setProjectId] = useState<string>("");

// Fetch projects on mount to get default
useEffect(() => {
  api<any[]>("/api/v1/admin/project").then((projects) => {
    if (projects.length > 0 && !projectId) setProjectId(projects[0].id);
  }).catch(() => {});
}, [token]);

// Replace the main content area:
{projectId && page === "overview" && <Overview projectId={projectId} />}
{projectId && page === "subscribers" && <Subscribers projectId={projectId} />}
{projectId && page === "rewards" && <Rewards projectId={projectId} />}
{projectId && page === "experiments" && <Experiments projectId={projectId} />}
{projectId && page === "webhooks" && <Webhooks projectId={projectId} />}
{page === "settings" && <Settings projectId={projectId} onProjectChange={setProjectId} />}
{!projectId && <div className="text-gray-400">Create a project in Settings to get started.</div>}
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/
git commit -m "feat: add admin dashboard pages (overview, subscribers, rewards, experiments, webhooks, settings)"
```

---

## Phase 6: Polish & Deployment

### Task 18: Dockerfile & Docker Compose Production Config

**Files:**
- Create: `Dockerfile`
- Modify: `docker-compose.yml` (add api service)

- [ ] **Step 1: Create multi-stage Dockerfile**

```dockerfile
# Dockerfile

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM deps AS build
RUN pnpm build

# Stage 3: Production
FROM node:20-alpine AS production
RUN apk add --no-cache dumb-init
RUN addgroup -g 1001 -S waitlist && adduser -S waitlist -u 1001
WORKDIR /app

COPY --from=build --chown=waitlist:waitlist /app/package.json ./
COPY --from=build --chown=waitlist:waitlist /app/node_modules ./node_modules
COPY --from=build --chown=waitlist:waitlist /app/packages ./packages
COPY --from=build --chown=waitlist:waitlist /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=waitlist:waitlist /app/apps/api/package.json ./apps/api/
COPY --from=build --chown=waitlist:waitlist /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build --chown=waitlist:waitlist /app/apps/admin/dist ./apps/admin/dist

USER waitlist
EXPOSE 3400

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/api/dist/server.js"]
```

- [ ] **Step 2: Add api service to docker-compose.yml**

Append to `docker-compose.yml` services section:

```yaml
  api:
    build: .
    ports:
      - "3400:3400"
    environment:
      DATABASE_URL: postgres://waitlist:waitlist@postgres:5432/waitlist
      REDIS_URL: redis://redis:6379
      PORT: 3400
      HOST: 0.0.0.0
      ADMIN_JWT_SECRET: change-me-in-production-min-32-chars
      CORS_ORIGINS: http://localhost:3400,http://localhost:5173
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
```

- [ ] **Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "feat: add Dockerfile and Docker Compose production config"
```

---

### Task 19: Vitest Config & Integration Test Setup

**Files:**
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/vitest.integration.config.ts`
- Modify: `apps/api/src/__tests__/` (ensure all tests pass)

- [ ] **Step 1: Create vitest configs**

```typescript
// apps/api/vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["src/__tests__/**/*.integration.test.ts"],
  },
});
```

```typescript
// apps/api/vitest.integration.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.integration.test.ts"],
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 2: Run all unit tests**

Run: `pnpm test`
Expected: All unit tests pass across all packages

- [ ] **Step 3: Commit**

```bash
git add apps/api/vitest*.config.ts
git commit -m "feat: add vitest configuration for unit and integration tests"
```

---

### Task 20: Final Build Verification & README

**Files:**
- Verify: full build works
- Verify: Docker Compose works
- Verify: all tests pass

- [ ] **Step 1: Full build**

Run: `pnpm install && pnpm build`
Expected: All packages and apps build successfully

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 3: Docker Compose smoke test**

Run: `docker compose up --build -d`
Run: `curl http://localhost:3400/health`
Expected: `{"status":"ok"}`

Run: `docker compose down`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify full build, tests, and Docker Compose"
```
