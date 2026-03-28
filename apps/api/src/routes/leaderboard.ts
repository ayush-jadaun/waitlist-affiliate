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
