import { z } from "zod";

export const subscribeSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().max(200).optional(),
  referralCode: z.string().regex(/^[a-zA-Z0-9]{6,12}$/, "Invalid referral code").optional(),
  metadata: z.record(z.unknown()).optional(),
  channel: z.enum(["twitter", "facebook", "linkedin", "whatsapp", "email", "copy", "other"]).optional(),
});

export const fieldDefinitionSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(["text", "number", "select", "url"]),
  label: z.string().min(1).max(100),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
});

export const referralConfigSchema = z.object({
  enabled: z.boolean(),
  positionBump: z.number().int().min(0).max(100).default(1),
  maxBumps: z.number().int().min(1).optional(),
});

export const rateLimitConfigSchema = z.object({
  window: z.string().regex(/^\d+[smh]$/, 'Must be like "1m", "30s", or "1h"'),
  max: z.number().int().min(1).max(10000),
});

export const rewardTierConfigSchema = z.object({
  name: z.string().min(1).max(100),
  threshold: z.number().int().min(1),
  rewardType: z.enum(["flag", "code", "custom"]),
  rewardValue: z.string().min(1).max(500),
});

export const projectConfigSchema = z.object({
  mode: z.enum(["prelaunch", "gated", "viral"]),
  name: z.string().min(1).max(200),
  maxSubscribers: z.number().int().min(1).optional(),
  requireEmailVerification: z.boolean().default(false),
  customFields: z.array(fieldDefinitionSchema).max(20).optional(),
  referral: referralConfigSchema,
  rewards: z.array(rewardTierConfigSchema).max(10).default([]),
  deduplication: z.enum(["email", "email+ip"]).default("email"),
  rateLimit: rateLimitConfigSchema.default({ window: "1m", max: 10 }),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const timeRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(["approve", "reject", "ban"]),
});

export const webhookEndpointSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  secret: z.string().min(16).max(128),
  events: z.array(z.enum([
    "subscriber.created", "subscriber.verified", "subscriber.approved", "subscriber.rejected",
    "referral.created", "reward.unlocked", "position.changed", "experiment.assigned", "waitlist.milestone",
  ])).min(1),
});

export const experimentSchema = z.object({
  name: z.string().min(1).max(200),
  variants: z.array(z.object({
    name: z.string().min(1).max(100),
    weight: z.number().min(0).max(100),
  })).min(2).max(5),
});
