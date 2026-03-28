import type { FastifyInstance } from "fastify";
import { adminAuthRoutes } from "./auth.js";
import { adminProjectRoutes } from "./project.js";
import { adminSubscribersRoutes } from "./subscribers.js";
import { adminRewardsRoutes } from "./rewards.js";
import { adminWebhooksRoutes } from "./webhooks.js";
import { adminExperimentsRoutes } from "./experiments.js";
import { adminAnalyticsRoutes } from "./analytics.js";

export async function adminRoutes(app: FastifyInstance) {
  await app.register(adminAuthRoutes);
  await app.register(adminProjectRoutes);
  await app.register(adminSubscribersRoutes);
  await app.register(adminRewardsRoutes);
  await app.register(adminWebhooksRoutes);
  await app.register(adminExperimentsRoutes);
  await app.register(adminAnalyticsRoutes);
}
