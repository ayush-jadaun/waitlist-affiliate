import type { FastifyInstance } from "fastify";
import { webhookEndpointSchema, paginationSchema } from "@waitlist/shared";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { webhookEndpoints, webhookDeliveries } from "../../db/schema.js";

const webhookQuerySchema = z.object({
  projectId: z.string().uuid(),
});

const createWebhookSchema = webhookEndpointSchema.extend({
  projectId: z.string().uuid(),
});

const deliveriesQuerySchema = paginationSchema.extend({
  // no extra fields needed beyond pagination
});

export async function adminWebhooksRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/webhooks?projectId=
  app.get("/api/v1/admin/webhooks", async (request, reply) => {
    const parsed = webhookQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const endpoints = await app.db
      .select()
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.projectId, parsed.data.projectId));

    return reply.send(endpoints);
  });

  // POST /api/v1/admin/webhooks
  app.post("/api/v1/admin/webhooks", async (request, reply) => {
    const parsed = createWebhookSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { projectId, url, secret, events } = parsed.data;

    const [endpoint] = await app.db
      .insert(webhookEndpoints)
      .values({ projectId, url, secret, events })
      .returning();

    return reply.status(201).send(endpoint);
  });

  // DELETE /api/v1/admin/webhooks/:id
  app.delete("/api/v1/admin/webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const [deleted] = await app.db
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id))
      .returning();

    if (!deleted) {
      return reply.status(404).send({ error: "Webhook endpoint not found" });
    }

    return reply.status(204).send();
  });

  // GET /api/v1/admin/webhooks/:id/deliveries
  app.get("/api/v1/admin/webhooks/:id/deliveries", async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = deliveriesQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { page, limit } = parsed.data;
    const offset = (page - 1) * limit;

    const deliveries = await app.db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.endpointId, id))
      .orderBy(webhookDeliveries.createdAt)
      .limit(limit)
      .offset(offset);

    return reply.send(deliveries);
  });
}
