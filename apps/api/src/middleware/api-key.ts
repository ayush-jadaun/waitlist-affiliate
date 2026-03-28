import type { FastifyRequest, FastifyReply } from "fastify";
import { eq } from "drizzle-orm";
import { projects } from "../db/schema.js";
import type { Database } from "../db/index.js";
import { createHash } from "node:crypto";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function apiKeyAuth(db: Database) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const apiKey = request.headers["x-api-key"] as string | undefined;
    if (!apiKey) {
      return reply.status(401).send({ error: "Missing X-API-Key header" });
    }

    const hash = hashApiKey(apiKey);
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.apiKeyHash, hash))
      .limit(1);

    if (!project) {
      return reply.status(401).send({ error: "Invalid API key" });
    }

    request.project = project;
  };
}
