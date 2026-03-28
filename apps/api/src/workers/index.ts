import type { Redis } from "ioredis";
import type { Database } from "../db/index.js";
import { createWorker, createQueue } from "../lib/queue.js";
import { createWebhookProcessor } from "./webhook.js";
import { createAnalyticsProcessor } from "./analytics.js";
import { createPositionProcessor } from "./position.js";

export function registerWorkers(db: Database, redis: Redis) {
  const webhookQueue = createQueue("webhook", redis);

  const webhookWorker = createWorker(
    "webhook",
    createWebhookProcessor(db, webhookQueue),
    redis,
    3
  );

  const analyticsWorker = createWorker(
    "analytics",
    createAnalyticsProcessor(db),
    redis,
    1
  );

  const positionWorker = createWorker(
    "position",
    createPositionProcessor(db),
    redis,
    1
  );

  const workers = [webhookWorker, analyticsWorker, positionWorker];

  return {
    workers,
    webhookQueue,
    async closeAll() {
      await Promise.all(workers.map((w) => w.close()));
      await webhookQueue.close();
    },
  };
}
