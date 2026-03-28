import type { FastifyInstance } from "fastify";
import { projectConfigSchema, API_KEY_PREFIX } from "@waitlist/shared";
import { eq } from "drizzle-orm";
import { projects } from "../../db/schema.js";
import { hashApiKey } from "../../middleware/api-key.js";
import { generateApiKey } from "../../lib/referral-code.js";

export async function adminProjectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticateAdmin);

  // GET /api/v1/admin/project — List all projects
  app.get("/api/v1/admin/project", async (_request, reply) => {
    const allProjects = await app.db.select().from(projects);
    return reply.send(allProjects);
  });

  // POST /api/v1/admin/project — Create project
  app.post("/api/v1/admin/project", async (request, reply) => {
    const parsed = projectConfigSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, mode, ...config } = parsed.data;

    const rawKey = generateApiKey(API_KEY_PREFIX);
    const keyHash = hashApiKey(rawKey);

    const [project] = await app.db
      .insert(projects)
      .values({
        name,
        mode,
        config: { mode, name, ...config },
        apiKey: rawKey,
        apiKeyHash: keyHash,
      })
      .returning();

    return reply.status(201).send({ ...project, apiKey: rawKey });
  });

  // PUT /api/v1/admin/project/:id — Update project config
  app.put("/api/v1/admin/project/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const parsed = projectConfigSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.mode !== undefined) updates.mode = parsed.data.mode;

    const [existing] = await app.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    if (!existing) {
      return reply.status(404).send({ error: "Project not found" });
    }

    const mergedConfig = {
      ...(existing.config as object ?? {}),
      ...parsed.data,
    };

    const [updated] = await app.db
      .update(projects)
      .set({
        ...updates,
        config: mergedConfig,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    return reply.send(updated);
  });
}
