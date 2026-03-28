import type { FastifyInstance } from "fastify";
import { subscribeRoutes } from "./subscribe.js";

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));
  await app.register(subscribeRoutes);
}
