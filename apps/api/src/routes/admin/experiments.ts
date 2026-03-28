import type { FastifyInstance } from "fastify";
import { experimentSchema } from "@waitlist/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { experiments } from "../../db/schema.js";

const experimentQuerySchema = z.object({
  projectId: z.string().uuid(),
});

const createExperimentSchema = experimentSchema.extend({
  projectId: z.string().uuid(),
});

export async function adminExperimentsRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/experiments?projectId=
  app.get("/api/v1/admin/experiments", async (request, reply) => {
    const parsed = experimentQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const rows = await app.db
      .select()
      .from(experiments)
      .where(eq(experiments.projectId, parsed.data.projectId));

    return reply.send(rows);
  });

  // POST /api/v1/admin/experiments
  app.post("/api/v1/admin/experiments", async (request, reply) => {
    const parsed = createExperimentSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { projectId, name, variants } = parsed.data;

    const [experiment] = await app.db
      .insert(experiments)
      .values({ projectId, name, variants })
      .returning();

    return reply.status(201).send(experiment);
  });

  // PATCH /api/v1/admin/experiments/:id — Toggle active status
  app.patch("/api/v1/admin/experiments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select()
      .from(experiments)
      .where(eq(experiments.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: "Experiment not found" });
    }

    const [updated] = await app.db
      .update(experiments)
      .set({ active: !existing.active })
      .where(eq(experiments.id, id))
      .returning();

    return reply.send(updated);
  });

  // DELETE /api/v1/admin/experiments/:id
  app.delete("/api/v1/admin/experiments/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [deleted] = await app.db
      .delete(experiments)
      .where(eq(experiments.id, id))
      .returning();

    if (!deleted) {
      return reply.status(404).send({ error: "Experiment not found" });
    }

    return reply.status(204).send();
  });
}
