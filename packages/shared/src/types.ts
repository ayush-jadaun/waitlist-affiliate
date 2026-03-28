export type WaitlistMode = "prelaunch" | "gated" | "viral";
export type SubscriberStatus = "waiting" | "pending" | "approved" | "rejected" | "active" | "banned";
export type RewardType = "flag" | "code" | "custom";
export type DeduplicationStrategy = "email" | "email+ip";

export interface FieldDefinition {
  name: string;
  type: "text" | "number" | "select" | "url";
  label: string;
  required: boolean;
  options?: string[];
}

export interface ReferralConfig {
  enabled: boolean;
  positionBump: number;
  maxBumps?: number;
}

export interface RateLimitConfig {
  window: string;
  max: number;
}

export interface ProjectConfig {
  mode: WaitlistMode;
  name: string;
  maxSubscribers?: number;
  requireEmailVerification: boolean;
  customFields?: FieldDefinition[];
  referral: ReferralConfig;
  rewards: RewardTierConfig[];
  deduplication: DeduplicationStrategy;
  rateLimit: RateLimitConfig;
}

export interface RewardTierConfig {
  name: string;
  threshold: number;
  rewardType: RewardType;
  rewardValue: string;
}

export interface SubscribeRequest {
  email: string;
  name?: string;
  referralCode?: string;
  metadata?: Record<string, unknown>;
  channel?: string;
  ip?: string;
}

export interface SubscribeResponse {
  id: string;
  email: string;
  position: number | null;
  referralCode: string;
  status: SubscriberStatus;
  totalSignups: number;
}

export interface SubscriberStatusResponse {
  position: number | null;
  referralCount: number;
  referralCode: string;
  rewards: string[];
  status: SubscriberStatus;
  experiment?: { name: string; variant: string };
}

export interface LeaderboardEntry {
  rank: number;
  name: string | null;
  referralCount: number;
}

export interface PublicStats {
  totalSignups: number;
  spotsRemaining: number | null;
  referralsMade: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  projectId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface AnalyticsOverview {
  totalSignups: number;
  todaySignups: number;
  totalReferrals: number;
  todayReferrals: number;
  conversionRate: number;
  kFactor: number;
}

export interface TimeseriesPoint {
  date: string;
  signups: number;
  referrals: number;
  kFactor: number;
}

export interface CohortRow {
  cohortWeek: string;
  size: number;
  referred1d: number;
  referred7d: number;
  referred30d: number;
  depth1: number;
  depth2: number;
  depth3: number;
}

export interface ChannelStats {
  channel: string;
  clicks: number;
  signups: number;
  conversionRate: number;
}
