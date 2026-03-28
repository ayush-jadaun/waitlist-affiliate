import { eq, and, gt, lte, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { subscribers } from "../db/schema.js";

export function calculateNewPosition(
  currentPosition: number,
  bumpAmount: number,
  maxBumps: number | undefined,
  totalBumpsApplied: number = 0
): number {
  if (maxBumps !== undefined && totalBumpsApplied >= maxBumps) {
    return currentPosition;
  }
  return Math.max(1, currentPosition - bumpAmount);
}

export async function applyPositionBump(
  db: Database,
  subscriberId: string,
  projectId: string,
  bumpAmount: number,
  maxBumps?: number
): Promise<number | null> {
  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.id, subscriberId))
    .limit(1);

  if (!subscriber || subscriber.position === null) return null;

  // Count how many bumps already applied (referral count)
  const [refResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(subscribers)
    .where(eq(subscribers.referredBy, subscriberId));

  const totalBumps = Number(refResult?.count ?? 0);
  const newPosition = calculateNewPosition(
    subscriber.position,
    bumpAmount,
    maxBumps,
    totalBumps - 1
  );

  if (newPosition === subscriber.position) return subscriber.position;

  const oldPosition = subscriber.position;

  // Move others down to fill the gap
  await db
    .update(subscribers)
    .set({
      position: sql`${subscribers.position} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(subscribers.projectId, projectId),
        lte(subscribers.position, oldPosition - 1),
        gt(subscribers.position, newPosition - 1)
      )
    );

  // Set the referrer's new position
  await db
    .update(subscribers)
    .set({ position: newPosition, updatedAt: new Date() })
    .where(eq(subscribers.id, subscriberId));

  return newPosition;
}
