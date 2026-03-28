import type { FastifyInstance } from "fastify";
import { subscribeSchema } from "@waitlist/shared";
import { eq, sql } from "drizzle-orm";
import { subscribers, referrals, rewardUnlocks, rewardTiers } from "../db/schema.js";
import { WaitlistService } from "../services/waitlist.js";
import { EventService } from "../services/events.js";
import { apiKeyAuth } from "../middleware/api-key.js";

export async function subscribeRoutes(app: FastifyInstance) {
  const waitlistService = new WaitlistService(app.db, new EventService(app.db));

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
      { email, name, referredBy, metadata, ip: request.ip, channel }
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

    const [refCount] = await app.db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(eq(referrals.referrerId, subscriber.id));

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
