import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { createDb } from "./db/index.js";
import { createRedis } from "./lib/redis.js";
import { registerJwt } from "./middleware/jwt.js";
import { registerRoutes } from "./routes/index.js";
import { registerWorkers } from "./workers/index.js";

const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const port = Number(process.env.PORT ?? 3400);
const host = process.env.HOST ?? "0.0.0.0";
const jwtSecret = process.env.ADMIN_JWT_SECRET;
const corsOrigins = process.env.CORS_ORIGINS?.split(",") ?? ["*"];

if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
if (!redisUrl) {
  console.error("REDIS_URL is required");
  process.exit(1);
}
if (!jwtSecret) {
  console.error("ADMIN_JWT_SECRET is required");
  process.exit(1);
}

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } });
const db = createDb(databaseUrl);
const redis = createRedis(redisUrl);

app.decorate("db", db);
app.decorate("redis", redis);

await app.register(cors, { origin: corsOrigins });
await app.register(rateLimit, { max: 100, timeWindow: "1 minute", redis });
await registerJwt(app, jwtSecret);
await registerRoutes(app);

const { closeAll: closeWorkers } = registerWorkers(db, redis);

// Graceful shutdown
let shuttingDown = false;

app.addHook("onRequest", async (_request, reply) => {
  if (shuttingDown) {
    reply.code(503).send({ error: "Service is shutting down" });
  }
});

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down gracefully...");

  const timer = setTimeout(() => {
    console.error("Shutdown timed out after 30s");
    process.exit(1);
  }, 30_000);

  try {
    await closeWorkers();
    await app.close();
    await redis.quit();
    clearTimeout(timer);
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

try {
  await app.listen({ port, host });
  console.log(`Server listening on ${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
