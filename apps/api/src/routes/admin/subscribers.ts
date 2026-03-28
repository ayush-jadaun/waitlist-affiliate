import type { FastifyInstance } from "fastify";
import { paginationSchema, bulkActionSchema } from "@waitlist/shared";
import { eq, and, ilike, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { subscribers } from "../../db/schema.js";

const subscribersQuerySchema = paginationSchema.extend({
  projectId: z.string().uuid(),
  status: z.string().optional(),
  search: z.string().optional(),
});

const patchSubscriberSchema = z.object({
  status: z.enum(["waiting", "approved", "rejected", "banned"]),
});

export async function adminSubscribersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/subscribers
  app.get("/api/v1/admin/subscribers", async (request, reply) => {
    const parsed = subscribersQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { projectId, page, limit, status, search } = parsed.data;
    const offset = (page - 1) * limit;

    const conditions = [eq(subscribers.projectId, projectId)];
    if (status) conditions.push(eq(subscribers.status, status));
    if (search) conditions.push(ilike(subscribers.email, `%${search}%`));

    const where = and(...conditions);

    const [rows, totalResult] = await Promise.all([
      app.db
        .select()
        .from(subscribers)
        .where(where)
        .orderBy(subscribers.createdAt)
        .limit(limit)
        .offset(offset),
      app.db
        .select({ value: sql<number>`count(*)` })
        .from(subscribers)
        .where(where),
    ]);

    const total = Number(totalResult[0]?.value ?? 0);

    return reply.send({
      data: rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  });

  // PATCH /api/v1/admin/subscribers/:id
  app.patch("/api/v1/admin/subscribers/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = patchSubscriberSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const [updated] = await app.db
      .update(subscribers)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(subscribers.id, id))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: "Subscriber not found" });
    }

    return reply.send(updated);
  });

  // POST /api/v1/admin/subscribers/bulk
  app.post("/api/v1/admin/subscribers/bulk", async (request, reply) => {
    const parsed = bulkActionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { ids, action } = parsed.data;

    const statusMap: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      ban: "banned",
    };

    await app.db
      .update(subscribers)
      .set({ status: statusMap[action]!, updatedAt: new Date() })
      .where(inArray(subscribers.id, ids));

    return reply.send({ updated: ids.length });
  });
}
