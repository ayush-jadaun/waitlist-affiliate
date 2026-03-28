import type { Database } from "../db/index.js";
import { events } from "../db/schema.js";
import type { Queue } from "bullmq";

export class EventService {
  constructor(
    private db: Database,
    private webhookQueue?: Queue,
    private analyticsQueue?: Queue
  ) {}

  async emit(
    projectId: string,
    type: string,
    subscriberId: string | null,
    data: Record<string, unknown> = {}
  ) {
    const rows = await this.db
      .insert(events)
      .values({ projectId, type, subscriberId, data })
      .returning();

    const event = rows[0];
    if (!event) throw new Error("Failed to insert event");

    if (this.webhookQueue) {
      await this.webhookQueue.add("dispatch", {
        eventId: event.id,
        projectId,
        type,
        data: { subscriberId, ...data },
      });
    }

    if (this.analyticsQueue) {
      await this.analyticsQueue.add("aggregate", {
        projectId,
        type,
        timestamp: event.createdAt.toISOString(),
      });
    }

    return event;
  }
}
