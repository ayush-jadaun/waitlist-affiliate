import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  text,
  real,
  timestamp,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ─── projects ────────────────────────────────────────────────────────────────

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 200 }).notNull(),
  mode: varchar("mode", { length: 20 }).notNull(),
  config: jsonb("config"),
  apiKey: varchar("api_key", { length: 64 }).unique(),
  apiKeyHash: varchar("api_key_hash", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── subscribers ─────────────────────────────────────────────────────────────

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
    referredBy: uuid("referred_by").references((): AnyPgColumn => subscribers.id, {
      onDelete: "set null",
    }),
    position: integer("position"),
    status: varchar("status", { length: 20 }).notNull().default("waiting"),
    emailVerified: boolean("email_verified").notNull().default(false),
    metadata: jsonb("metadata"),
    signupIp: varchar("signup_ip", { length: 45 }),
    signupChannel: varchar("signup_channel", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("subscribers_project_email_idx").on(t.projectId, t.email),
    uniqueIndex("subscribers_referral_code_idx").on(t.referralCode),
    index("subscribers_project_status_idx").on(t.projectId, t.status),
    index("subscribers_project_position_idx").on(t.projectId, t.position),
    index("subscribers_referred_by_idx").on(t.referredBy),
  ],
);

// ─── referrals ───────────────────────────────────────────────────────────────

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("referrals_referrer_id_idx").on(t.referrerId),
    index("referrals_project_id_idx").on(t.projectId),
    uniqueIndex("referrals_referred_id_idx").on(t.referredId),
  ],
);

// ─── rewardTiers ─────────────────────────────────────────────────────────────

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
    rewardValue: varchar("reward_value", { length: 500 }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reward_tiers_project_id_idx").on(t.projectId)],
);

// ─── rewardUnlocks ───────────────────────────────────────────────────────────

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
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reward_unlocks_subscriber_tier_idx").on(t.subscriberId, t.tierId),
    index("reward_unlocks_subscriber_id_idx").on(t.subscriberId),
  ],
);

// ─── events ──────────────────────────────────────────────────────────────────

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
    data: jsonb("data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("events_project_type_idx").on(t.projectId, t.type),
    index("events_created_at_idx").on(t.createdAt),
  ],
);

// ─── analyticsDaily ──────────────────────────────────────────────────────────

export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    date: varchar("date", { length: 10 }).notNull(),
    signups: integer("signups").notNull().default(0),
    referrals: integer("referrals").notNull().default(0),
    verifiedReferrals: integer("verified_referrals").notNull().default(0),
    kFactor: real("k_factor"),
    rewardUnlocks: integer("reward_unlocks").notNull().default(0),
  },
  (t) => [uniqueIndex("analytics_daily_project_date_idx").on(t.projectId, t.date)],
);

// ─── analyticsCohorts ────────────────────────────────────────────────────────

export const analyticsCohorts = pgTable(
  "analytics_cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    cohortWeek: varchar("cohort_week", { length: 10 }).notNull(),
    size: integer("size").notNull().default(0),
    referred1d: integer("referred_1d").notNull().default(0),
    referred7d: integer("referred_7d").notNull().default(0),
    referred30d: integer("referred_30d").notNull().default(0),
    depth1: integer("depth_1").notNull().default(0),
    depth2: integer("depth_2").notNull().default(0),
    depth3: integer("depth_3").notNull().default(0),
  },
  (t) => [uniqueIndex("analytics_cohorts_project_week_idx").on(t.projectId, t.cohortWeek)],
);

// ─── experiments ─────────────────────────────────────────────────────────────

export const experiments = pgTable(
  "experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    variants: jsonb("variants").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("experiments_project_id_idx").on(t.projectId)],
);

// ─── experimentAssignments ───────────────────────────────────────────────────

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
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("experiment_assignments_exp_sub_idx").on(t.experimentId, t.subscriberId),
    index("experiment_assignments_exp_id_idx").on(t.experimentId),
  ],
);

// ─── webhookEndpoints ─────────────────────────────────────────────────────────

export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 2048 }).notNull(),
    secret: varchar("secret", { length: 128 }),
    events: jsonb("events").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_endpoints_project_id_idx").on(t.projectId)],
);

// ─── webhookDeliveries ────────────────────────────────────────────────────────

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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhook_deliveries_endpoint_id_idx").on(t.endpointId),
    index("webhook_deliveries_next_retry_at_idx").on(t.nextRetryAt),
  ],
);

// ─── adminUsers ───────────────────────────────────────────────────────────────

export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 256 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
