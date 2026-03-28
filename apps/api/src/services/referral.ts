import { eq, and, sql, gte } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { referrals, subscribers, rewardTiers, rewardUnlocks } from "../db/schema.js";
import { DISPOSABLE_EMAIL_DOMAINS } from "@waitlist/shared";
import type { EventService } from "./events.js";
import { applyPositionBump } from "./position.js";

export class ReferralService {
  constructor(
    private db?: Database,
    private eventService?: EventService
  ) {}

  isSelfReferral(referrerEmail: string, referredEmail: string): boolean {
    return referrerEmail.toLowerCase() === referredEmail.toLowerCase();
  }

  isDisposableEmail(email: string): boolean {
    const domain = email.split("@")[1]?.toLowerCase();
    return domain ? DISPOSABLE_EMAIL_DOMAINS.includes(domain) : false;
  }

  async isSameIpRecent(
    projectId: string,
    ip: string,
    windowMs: number = 3600_000
  ): Promise<boolean> {
    if (!this.db) throw new Error("Database required");

    const since = new Date(Date.now() - windowMs);
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(
        and(
          eq(subscribers.projectId, projectId),
          eq(subscribers.signupIp, ip),
          gte(subscribers.createdAt, since)
        )
      );

    return Number(result?.count ?? 0) > 0;
  }

  async processReferral(
    projectId: string,
    referrerId: string,
    referredId: string,
    config: { positionBump: number; maxBumps?: number }
  ) {
    if (!this.db || !this.eventService) throw new Error("Dependencies required");

    await this.eventService.emit(projectId, "referral.created", referrerId, { referredId });

    const newPosition = await applyPositionBump(
      this.db,
      referrerId,
      projectId,
      config.positionBump,
      config.maxBumps
    );

    if (newPosition !== null) {
      await this.eventService.emit(projectId, "position.changed", referrerId, { newPosition });
    }

    await this.checkRewardUnlocks(projectId, referrerId);
  }

  async checkRewardUnlocks(projectId: string, subscriberId: string) {
    if (!this.db || !this.eventService) throw new Error("Dependencies required");

    const [refResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(and(eq(referrals.referrerId, subscriberId), eq(referrals.verified, true)));

    const referralCount = Number(refResult?.count ?? 0);

    const tiers = await this.db
      .select()
      .from(rewardTiers)
      .where(eq(rewardTiers.projectId, projectId));

    for (const tier of tiers) {
      if (referralCount >= tier.threshold) {
        const [existing] = await this.db
          .select()
          .from(rewardUnlocks)
          .where(and(eq(rewardUnlocks.subscriberId, subscriberId), eq(rewardUnlocks.tierId, tier.id)))
          .limit(1);

        if (!existing) {
          await this.db.insert(rewardUnlocks).values({ subscriberId, tierId: tier.id });

          await this.eventService.emit(projectId, "reward.unlocked", subscriberId, {
            tierName: tier.name,
            rewardType: tier.rewardType,
            rewardValue: tier.rewardValue,
            threshold: tier.threshold,
          });
        }
      }
    }
  }
}
