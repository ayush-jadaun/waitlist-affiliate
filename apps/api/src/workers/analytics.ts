import type { Job } from "bullmq";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { subscribers, referrals, analyticsDaily, rewardUnlocks } from "../db/schema.js";

export interface AnalyticsJobData {
  projectId: string;
  type: string;
  timestamp: string;
}

export function createAnalyticsProcessor(db: Database) {
  return async function processAnalytics(job: Job<AnalyticsJobData>) {
    const { projectId, timestamp } = job.data;
    const date = timestamp.slice(0, 10); // YYYY-MM-DD

    const dayStart = new Date(`${date}T00:00:00Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const [signupCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(subscribers)
      .where(and(eq(subscribers.projectId, projectId), gte(subscribers.createdAt, dayStart), lte(subscribers.createdAt, dayEnd)));

    const [referralCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(and(eq(referrals.projectId, projectId), gte(referrals.createdAt, dayStart), lte(referrals.createdAt, dayEnd)));

    const [verifiedReferralCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(referrals)
      .where(and(eq(referrals.projectId, projectId), eq(referrals.verified, true), gte(referrals.createdAt, dayStart), lte(referrals.createdAt, dayEnd)));

    const [unlockCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(rewardUnlocks)
      .where(and(gte(rewardUnlocks.unlockedAt, dayStart), lte(rewardUnlocks.unlockedAt, dayEnd)));

    const signups = Number(signupCount?.count ?? 0);
    const refs = Number(referralCount?.count ?? 0);
    const verifiedRefs = Number(verifiedReferralCount?.count ?? 0);
    const kFactor = signups > 0 ? verifiedRefs / signups : 0;

    await db
      .insert(analyticsDaily)
      .values({
        projectId,
        date,
        signups,
        referrals: refs,
        verifiedReferrals: verifiedRefs,
        kFactor: Math.round(kFactor * 100) / 100,
        rewardUnlocks: Number(unlockCount?.count ?? 0),
      })
      .onConflictDoUpdate({
        target: [analyticsDaily.projectId, analyticsDaily.date],
        set: {
          signups,
          referrals: refs,
          verifiedReferrals: verifiedRefs,
          kFactor: Math.round(kFactor * 100) / 100,
          rewardUnlocks: Number(unlockCount?.count ?? 0),
        },
      });
  };
}
