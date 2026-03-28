import type { Job, Queue } from "bullmq";
import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { webhookEndpoints } from "../db/schema.js";
import { WebhookService, signPayload } from "../services/webhook.js";

export interface WebhookJobData {
  eventId: string;
  projectId: string;
  type: string;
  data: Record<string, unknown>;
  endpointId?: string;
  attempt?: number;
}

export function createWebhookProcessor(db: Database, queue: Queue<WebhookJobData>) {
  const webhookService = new WebhookService(db);

  return async function processWebhook(job: Job<WebhookJobData>) {
    const { projectId, type, data, endpointId, attempt = 1 } = job.data;

    if (endpointId) {
      await deliverToEndpoint(db, webhookService, queue, endpointId, type, data, attempt, job);
      return;
    }

    const endpoints = await webhookService.getEndpointsForEvent(projectId, type);
    for (const endpoint of endpoints) {
      await deliverToEndpoint(db, webhookService, queue, endpoint.id, type, data, 1, job);
    }
  };
}

async function deliverToEndpoint(
  db: Database,
  webhookService: WebhookService,
  queue: Queue<WebhookJobData>,
  endpointId: string,
  eventType: string,
  data: Record<string, unknown>,
  attempt: number,
  job: Job<WebhookJobData>
) {
  const [endpoint] = await db
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, endpointId))
    .limit(1);

  if (!endpoint || !endpoint.active) return;

  const payload = JSON.stringify({
    id: crypto.randomUUID(),
    type: eventType,
    data,
    timestamp: new Date().toISOString(),
  });

  const signature = signPayload(payload, endpoint.secret ?? "");

  let statusCode: number | null = null;
  let responseBody: string | null = null;

  try {
    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": eventType,
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
    });

    statusCode = response.status;
    responseBody = await response.text().catch(() => null);
  } catch (err) {
    responseBody = err instanceof Error ? err.message : "Unknown error";
  }

  const { shouldRetry, nextRetryAt } = await webhookService.recordDelivery(
    endpointId,
    eventType,
    data,
    statusCode,
    responseBody,
    attempt
  );

  if (shouldRetry && nextRetryAt) {
    const delay = nextRetryAt.getTime() - Date.now();
    await queue.add("dispatch", { ...job.data, endpointId, attempt: attempt + 1 }, { delay });
  }
}
