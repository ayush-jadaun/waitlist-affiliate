import type { Database } from "./db/index.js";
import type { Redis } from "ioredis";
import type { InferSelectModel } from "drizzle-orm";
import type { projects } from "./db/schema.js";

type Project = InferSelectModel<typeof projects>;

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    redis: Redis;
    authenticateAdmin: (request: any, reply: any) => Promise<void>;
  }
  interface FastifyRequest {
    project?: Project;
  }
}
