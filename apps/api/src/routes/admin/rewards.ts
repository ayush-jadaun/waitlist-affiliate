import type { FastifyInstance } from "fastify";
import { rewardTierConfigSchema } from "@waitlist/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { rewardTiers } from "../../db/schema.js";

const rewardQuerySchema = z.object({
  projectId: z.string().uuid(),
});

const createRewardSchema = rewardTierConfigSchema.extend({
  projectId: z.string().uuid(),
  sortOrder: z.number().int().min(0).default(0),
});

export async function adminRewardsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/rewards?projectId=
  app.get("/api/v1/admin/rewards", async (request, reply) => {
    const parsed = rewardQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const tiers = await app.db
      .select()
      .from(rewardTiers)
      .where(eq(rewardTiers.projectId, parsed.data.projectId))
      .orderBy(rewardTiers.sortOrder);

    return reply.send(tiers);
  });

  // POST /api/v1/admin/rewards
  app.post("/api/v1/admin/rewards", async (request, reply) => {
    const parsed = createRewardSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { projectId, name, threshold, rewardType, rewardValue, sortOrder } = parsed.data;

    const [tier] = await app.db
      .insert(rewardTiers)
      .values({ projectId, name, threshold, rewardType, rewardValue, sortOrder })
      .returning();

    return reply.status(201).send(tier);
  });

  // PUT /api/v1/admin/rewards/:id
  app.put("/api/v1/admin/rewards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = createRewardSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [existing] = await app.db
      .select()
      .from(rewardTiers)
      .where(eq(rewardTiers.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: "Reward tier not found" });
    }

    const [updated] = await app.db
      .update(rewardTiers)
      .set(parsed.data)
      .where(eq(rewardTiers.id, id))
      .returning();

    return reply.send(updated);
  });

  // DELETE /api/v1/admin/rewards/:id
  app.delete("/api/v1/admin/rewards/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [deleted] = await app.db
      .delete(rewardTiers)
      .where(eq(rewardTiers.id, id))
      .returning();

    if (!deleted) {
      return reply.status(404).send({ error: "Reward tier not found" });
    }

    return reply.status(204).send();
  });
}
