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
