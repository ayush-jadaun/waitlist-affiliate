import { createHmac, timingSafeEqual } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { webhookEndpoints, webhookDeliveries } from "../db/schema.js";
import { WEBHOOK_RETRY_DELAYS, WEBHOOK_MAX_RETRIES } from "@waitlist/shared";

export function signPayload(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${hmac}`;
}

export function verifySignature(payload: string, secret: string, signature: string): boolean {
  const expected = signPayload(payload, secret);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export class WebhookService {
  constructor(private db: Database) {}

  async getEndpointsForEvent(projectId: string, eventType: string) {
    const endpoints = await this.db
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.projectId, projectId), eq(webhookEndpoints.active, true)));

    return endpoints.filter((ep) => {
      const events = ep.events as string[];
      return events.includes(eventType);
    });
  }

  async recordDelivery(
    endpointId: string,
    eventType: string,
    payload: Record<string, unknown>,
    statusCode: number | null,
    responseBody: string | null,
    attempt: number
  ) {
    const shouldRetry = (statusCode === null || statusCode >= 500) && attempt < WEBHOOK_MAX_RETRIES;
    const retryDelay = WEBHOOK_RETRY_DELAYS[attempt - 1];
    const nextRetryAt = shouldRetry && retryDelay !== undefined ? new Date(Date.now() + retryDelay) : null;

    await this.db.insert(webhookDeliveries).values({
      endpointId,
      eventType,
      payload,
      statusCode,
      responseBody,
      attempt,
      deliveredAt: statusCode !== null && statusCode < 400 ? new Date() : null,
      nextRetryAt,
    });

    return { shouldRetry, nextRetryAt };
  }
}
