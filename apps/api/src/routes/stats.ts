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
