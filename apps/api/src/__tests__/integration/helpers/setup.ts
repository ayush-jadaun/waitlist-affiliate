import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createDb } from "../../../db/index.js";
import { createRedis } from "../../../lib/redis.js";
import { registerJwt } from "../../../middleware/jwt.js";
import { registerRoutes } from "../../../routes/index.js";
import {
  adminUsers,
  projects,
  subscribers,
  referrals,
  rewardTiers,
  rewardUnlocks,
  events,
  analyticsDaily,
  analyticsCohorts,
  experiments,
  experimentAssignments,
  webhookEndpoints,
  webhookDeliveries,
} from "../../../db/schema.js";
import { hashApiKey } from "../../../middleware/api-key.js";
import { generateApiKey } from "../../../lib/referral-code.js";
import { API_KEY_PREFIX } from "@waitlist/shared";
import { sql } from "drizzle-orm";

export const TEST_DB_URL = process.env.DATABASE_URL ?? "postgres://waitlist:waitlist@localhost:5434/waitlist";
export const TEST_REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6381";
export const TEST_JWT_SECRET = process.env.ADMIN_JWT_SECRET ?? "test-secret-at-least-32-characters-long";

export async function createTestApp(): Promise<FastifyInstance> {
  // Disable logging and use high rate limits for testing
  const app = Fastify({ logger: false });

  const db = createDb(TEST_DB_URL);
  const redis = createRedis(TEST_REDIS_URL);

  app.decorate("db", db);
  app.decorate("redis", redis);

  await app.register(cors, { origin: "*" });
  // NOTE: Rate limiting is intentionally NOT registered in tests to avoid
  // test interference. The production server registers it; here we skip it.
  await registerJwt(app, TEST_JWT_SECRET);
  await registerRoutes(app);

  await app.ready();

  return app;
}

export async function createTestProject(
  app: FastifyInstance,
  overrides: Record<string, unknown> = {}
): Promise<{ project: typeof projects.$inferSelect; apiKey: string }> {
  const rawKey = generateApiKey(API_KEY_PREFIX);
  const keyHash = hashApiKey(rawKey);

  const config = {
    mode: "prelaunch",
    name: "Test Project",
    requireEmailVerification: false,
    referral: { enabled: true, positionBump: 1 },
    rewards: [],
    deduplication: "email",
    rateLimit: { window: "1m", max: 100 },
    ...overrides,
  };

  const [project] = await app.db
    .insert(projects)
    .values({
      name: (config.name as string) ?? "Test Project",
      mode: (config.mode as string) ?? "prelaunch",
      config,
      apiKey: rawKey,
      apiKeyHash: keyHash,
    })
    .returning();

  if (!project) throw new Error("Failed to create test project");

  return { project, apiKey: rawKey };
}

export async function createAdminAndGetToken(app: FastifyInstance): Promise<string> {
  const { createHash } = await import("node:crypto");
  const passwordHash = createHash("sha256").update("testpassword123").digest("hex");

  const [admin] = await app.db
    .insert(adminUsers)
    .values({ email: "admin@test.com", passwordHash })
    .returning();

  if (!admin) throw new Error("Failed to create admin");

  const token = app.jwt.sign({ sub: admin.id, email: admin.email });
  return token;
}

export async function cleanDatabase(app: FastifyInstance): Promise<void> {
  // Delete in dependency order to avoid FK violations
  await app.db.execute(sql`TRUNCATE TABLE
    webhook_deliveries,
    webhook_endpoints,
    experiment_assignments,
    experiments,
    analytics_cohorts,
    analytics_daily,
    events,
    reward_unlocks,
    reward_tiers,
    referrals,
    subscribers,
    projects,
    admin_users
  CASCADE`);

  // Flush Redis cache
  await app.redis.flushdb();
}

export async function closeTestApp(app: FastifyInstance): Promise<void> {
  await app.close();
}
