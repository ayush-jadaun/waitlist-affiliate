import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createHash } from "node:crypto";
import { eq, count } from "drizzle-orm";
import { adminUsers } from "../../db/schema.js";

const adminAuthSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function adminAuthRoutes(app: FastifyInstance) {
  // POST /api/v1/admin/auth/setup — First-time admin creation
  app.post("/api/v1/admin/auth/setup", async (request, reply) => {
    const parsed = adminAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;

    // Only works if no admin users exist
    const countResult = await app.db
      .select({ value: count() })
      .from(adminUsers);

    if (Number(countResult[0]?.value ?? 0) > 0) {
      return reply.status(409).send({ error: "Admin already exists" });
    }

    const passwordHash = hashPassword(password);

    const [admin] = await app.db
      .insert(adminUsers)
      .values({ email, passwordHash })
      .returning();

    const token = app.jwt.sign({ sub: admin!.id, email: admin!.email });

    return reply.status(201).send({ token });
  });

  // POST /api/v1/admin/auth/login
  app.post("/api/v1/admin/auth/login", async (request, reply) => {
    const parsed = adminAuthSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;

    const [admin] = await app.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    if (!admin || admin.passwordHash !== hashPassword(password)) {
      return reply.status(401).send({ error: "Invalid credentials" });
    }

    const token = app.jwt.sign({ sub: admin.id, email: admin.email });

    return reply.send({ token });
  });
}
