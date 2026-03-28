import { eq, and, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { subscribers } from "../db/schema.js";
import { generateReferralCode } from "../lib/referral-code.js";
import type { EventService } from "./events.js";
import type { WaitlistMode, SubscriberStatus } from "@waitlist/shared";

export class WaitlistService {
  constructor(
    private db?: Database,
    private eventService?: EventService
  ) {}

  getInitialStatus(mode: WaitlistMode): SubscriberStatus {
    switch (mode) {
      case "prelaunch": return "waiting";
      case "gated": return "pending";
      case "viral": return "active";
    }
  }

  shouldAssignPosition(mode: WaitlistMode): boolean {
    return mode !== "gated";
  }

  async subscribe(
    projectId: string,
    mode: WaitlistMode,
    input: {
      email: string;
      name?: string;
      referredBy?: string;
      metadata?: Record<string, unknown>;
      ip?: string;
      channel?: string;
    }
  ) {
    if (!this.db) throw new Error("Database required");

    // Check duplicate
    const [existing] = await this.db
      .select()
      .from(subscribers)
      .where(and(eq(subscribers.projectId, projectId), eq(subscribers.email, input.email)))
      .limit(1);

    if (existing) {
      return { subscriber: existing, isNew: false };
    }

    // Get next position
    let position: number | null = null;
    if (this.shouldAssignPosition(mode)) {
      const [result] = await this.db
        .select({ maxPos: sql<number>`coalesce(max(${subscribers.position}), 0)` })
        .from(subscribers)
        .where(eq(subscribers.projectId, projectId));
      position = (result?.maxPos ?? 0) + 1;
    }

    const referralCode = generateReferralCode();
    const status = this.getInitialStatus(mode);

    const insertedRows = await this.db
      .insert(subscribers)
      .values({
        projectId,
        email: input.email,
        name: input.name,
        referralCode,
        referredBy: input.referredBy,
        position,
        status,
        metadata: input.metadata ?? {},
        signupIp: input.ip,
        signupChannel: input.channel,
      })
      .returning();

    const subscriber = insertedRows[0];
    if (!subscriber) throw new Error("Failed to insert subscriber");

    if (this.eventService) {
      await this.eventService.emit(projectId, "subscriber.created", subscriber.id, {
        email: subscriber.email,
        position: subscriber.position,
        referredBy: input.referredBy,
        channel: input.channel,
      });
    }

    return { subscriber, isNew: true };
  }

  async getStatus(projectId: string, email: string) {
    if (!this.db) throw new Error("Database required");

    const [subscriber] = await this.db
      .select()
      .from(subscribers)
      .where(and(eq(subscribers.projectId, projectId), eq(subscribers.email, email)))
      .limit(1);

    return subscriber ?? null;
  }

  async getCount(projectId: string): Promise<number> {
    if (!this.db) throw new Error("Database required");

    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(eq(subscribers.projectId, projectId));

    return Number(result?.count ?? 0);
  }
}
