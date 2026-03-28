import type { FastifyInstance } from "fastify";
import { timeRangeSchema, ANALYTICS_CACHE_TTL } from "@waitlist/shared";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import {
  subscribers,
  referrals,
  analyticsDaily,
  analyticsCohorts,
} from "../../db/schema.js";

const projectQuerySchema = z.object({
  projectId: z.string().uuid(),
});

const timeseriesQuerySchema = projectQuerySchema.extend({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export async function adminAnalyticsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/analytics/overview?projectId=
  app.get("/api/v1/admin/analytics/overview", async (request, reply) => {
    const parsed = projectQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { projectId } = parsed.data;
    const cacheKey = `analytics:overview:${projectId}`;

    const cached = await app.redis.get(cacheKey);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    const [
      totalSignupsResult,
      todaySignupsResult,
      totalReferralsResult,
      todayReferralsResult,
    ] = await Promise.all([
      app.db
        .select({ value: sql<number>`count(*)` })
        .from(subscribers)
        .where(eq(subscribers.projectId, projectId)),
      app.db
        .select({ value: sql<number>`count(*)` })
        .from(subscribers)
        .where(
          and(
            eq(subscribers.projectId, projectId),
            sql`DATE(${subscribers.createdAt}) = ${todayStr}`,
          ),
        ),
      app.db
        .select({ value: sql<number>`count(*)` })
        .from(referrals)
        .where(eq(referrals.projectId, projectId)),
      app.db
        .select({ value: sql<number>`count(*)` })
        .from(referrals)
        .where(
          and(
            eq(referrals.projectId, projectId),
            sql`DATE(${referrals.createdAt}) = ${todayStr}`,
          ),
        ),
    ]);

    const total = Number(totalSignupsResult[0]?.value ?? 0);
    const totalRef = Number(totalReferralsResult[0]?.value ?? 0);
    const conversionRate = total > 0 ? totalRef / total : 0;
    const kFactor = total > 0 ? totalRef / total : 0;

    const overview = {
      totalSignups: total,
      todaySignups: Number(todaySignupsResult[0]?.value ?? 0),
      totalReferrals: totalRef,
      todayReferrals: Number(todayReferralsResult[0]?.value ?? 0),
      conversionRate: Math.round(conversionRate * 10000) / 10000,
      kFactor: Math.round(kFactor * 10000) / 10000,
    };

    await app.redis.setex(cacheKey, ANALYTICS_CACHE_TTL, JSON.stringify(overview));

    return reply.send(overview);
  });

  // GET /api/v1/admin/analytics/timeseries?projectId=&from=&to=
  app.get("/api/v1/admin/analytics/timeseries", async (request, reply) => {
    const parsed = timeseriesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { projectId, from, to } = parsed.data;
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const rows = await app.db
      .select()
      .from(analyticsDaily)
      .where(
        and(
          eq(analyticsDaily.projectId, projectId),
          gte(analyticsDaily.date, fromStr),
          lte(analyticsDaily.date, toStr),
        ),
      )
      .orderBy(analyticsDaily.date);

    return reply.send(rows);
  });

  // GET /api/v1/admin/analytics/cohorts?projectId=
  app.get("/api/v1/admin/analytics/cohorts", async (request, reply) => {
    const parsed = projectQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const rows = await app.db
      .select()
      .from(analyticsCohorts)
      .where(eq(analyticsCohorts.projectId, parsed.data.projectId))
      .orderBy(analyticsCohorts.cohortWeek);

    return reply.send(rows);
  });

  // GET /api/v1/admin/analytics/channels?projectId=
  app.get("/api/v1/admin/analytics/channels", async (request, reply) => {
    const parsed = projectQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { projectId } = parsed.data;

    const rows = await app.db
      .select({
        channel: referrals.channel,
        count: sql<number>`count(*)`,
      })
      .from(referrals)
      .where(eq(referrals.projectId, projectId))
      .groupBy(referrals.channel);

    return reply.send(rows);
  });
}
