import type { Job } from "bullmq";
import type { Database } from "../db/index.js";
import { applyPositionBump } from "../services/position.js";

export interface PositionJobData {
  projectId: string;
  subscriberId: string;
  bumpAmount: number;
  maxBumps?: number;
}

export function createPositionProcessor(db: Database) {
  return async function processPosition(job: Job<PositionJobData>) {
    const { projectId, subscriberId, bumpAmount, maxBumps } = job.data;
    await applyPositionBump(db, subscriberId, projectId, bumpAmount, maxBumps);
  };
}
