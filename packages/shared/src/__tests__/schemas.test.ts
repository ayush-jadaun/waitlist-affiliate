import { describe, it, expect } from "vitest";
import {
  subscribeSchema,
  projectConfigSchema,
  paginationSchema,
  bulkActionSchema,
  webhookEndpointSchema,
  experimentSchema,
  rewardTierConfigSchema,
  timeRangeSchema,
} from "../schemas.js";
import { WEBHOOK_EVENTS, SHARE_CHANNELS } from "../constants.js";

// ── subscribeSchema ───────────────────────────────────────────────────────────
describe("subscribeSchema", () => {
  describe("valid inputs", () => {
    it("accepts a minimal valid object with just email", () => {
      const result = subscribeSchema.safeParse({ email: "user@example.com" });
      expect(result.success).toBe(true);
    });

    it("accepts a full object with all optional fields", () => {
      const result = subscribeSchema.safeParse({
        email: "user@example.com",
        name: "John Doe",
        referralCode: "abc12345",
        metadata: { source: "landing" },
        channel: "twitter",
      });
      expect(result.success).toBe(true);
    });

    it("accepts all 7 channel enum values", () => {
      for (const ch of SHARE_CHANNELS) {
        const result = subscribeSchema.safeParse({ email: "u@e.com", channel: ch });
        expect(result.success, `channel '${ch}' should be valid`).toBe(true);
      }
    });

    it("accepts a valid referral code — exactly 8 alphanumeric chars", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", referralCode: "abc12345" });
      expect(result.success).toBe(true);
    });

    it("accepts referral code with 6 characters (min of regex)", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", referralCode: "abcd12" });
      expect(result.success).toBe(true);
    });

    it("accepts referral code with 12 characters (max of regex)", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", referralCode: "abcdefghij12" });
      expect(result.success).toBe(true);
    });

    it("accepts name up to 200 characters", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", name: "J".repeat(200) });
      expect(result.success).toBe(true);
    });

    it("accepts standard name 'John'", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", name: "John" });
      expect(result.success).toBe(true);
    });

    it("accepts metadata as a record", () => {
      const result = subscribeSchema.safeParse({
        email: "u@e.com",
        metadata: { key: "value", num: 42, nested: { deep: true } },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects missing email", () => {
      const result = subscribeSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("rejects empty email string", () => {
      const result = subscribeSchema.safeParse({ email: "" });
      expect(result.success).toBe(false);
    });

    it("rejects malformed email", () => {
      const result = subscribeSchema.safeParse({ email: "not-an-email" });
      expect(result.success).toBe(false);
    });

    it("rejects email without domain", () => {
      const result = subscribeSchema.safeParse({ email: "user@" });
      expect(result.success).toBe(false);
    });

    it("rejects email without @", () => {
      const result = subscribeSchema.safeParse({ email: "userexample.com" });
      expect(result.success).toBe(false);
    });

    it("rejects referral code shorter than 6 characters", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", referralCode: "ab" });
      expect(result.success).toBe(false);
    });

    it("rejects referral code with special characters (abc-123!)", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", referralCode: "abc-123!" });
      expect(result.success).toBe(false);
    });

    it("rejects referral code with dash", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", referralCode: "abc-1234" });
      expect(result.success).toBe(false);
    });

    it("rejects referral code with space", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", referralCode: "abc 1234" });
      expect(result.success).toBe(false);
    });

    it("rejects referral code longer than 12 characters", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", referralCode: "abcdefghijk12" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid channel 'instagram'", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", channel: "instagram" });
      expect(result.success).toBe(false);
    });

    it("rejects invalid channel 'tiktok'", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", channel: "tiktok" });
      expect(result.success).toBe(false);
    });

    it("rejects name longer than 200 characters", () => {
      const result = subscribeSchema.safeParse({ email: "u@e.com", name: "A".repeat(201) });
      expect(result.success).toBe(false);
    });
  });
});

// ── projectConfigSchema ───────────────────────────────────────────────────────
describe("projectConfigSchema", () => {
  const validReferral = { enabled: true, positionBump: 1 };
  const validConfig = {
    mode: "prelaunch",
    name: "My Waitlist",
    referral: validReferral,
  };

  describe("valid inputs", () => {
    it("accepts a minimal valid config", () => {
      const result = projectConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it("accepts all three valid modes", () => {
      for (const mode of ["prelaunch", "gated", "viral"] as const) {
        const result = projectConfigSchema.safeParse({ ...validConfig, mode });
        expect(result.success, `mode '${mode}' should be valid`).toBe(true);
      }
    });

    it("accepts full config with all optional fields", () => {
      const result = projectConfigSchema.safeParse({
        ...validConfig,
        maxSubscribers: 500,
        requireEmailVerification: true,
        customFields: [
          { name: "company", type: "text", label: "Company", required: false },
        ],
        rewards: [
          { name: "Early Bird", threshold: 3, rewardType: "flag", rewardValue: "early_bird" },
        ],
        deduplication: "email+ip",
        rateLimit: { window: "30s", max: 5 },
      });
      expect(result.success).toBe(true);
    });

    it("applies default requireEmailVerification = false", () => {
      const result = projectConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.requireEmailVerification).toBe(false);
      }
    });

    it("applies default deduplication = 'email'", () => {
      const result = projectConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deduplication).toBe("email");
      }
    });

    it("applies default rateLimit = { window: '1m', max: 10 }", () => {
      const result = projectConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rateLimit).toEqual({ window: "1m", max: 10 });
      }
    });

    it("applies default rewards = []", () => {
      const result = projectConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rewards).toEqual([]);
      }
    });

    it("accepts maxSubscribers = 1 (minimum valid)", () => {
      const result = projectConfigSchema.safeParse({ ...validConfig, maxSubscribers: 1 });
      expect(result.success).toBe(true);
    });

    it("accepts up to 20 customFields", () => {
      const fields = Array.from({ length: 20 }, (_, i) => ({
        name: `field_${i}`,
        type: "text" as const,
        label: `Field ${i}`,
        required: false,
      }));
      const result = projectConfigSchema.safeParse({ ...validConfig, customFields: fields });
      expect(result.success).toBe(true);
    });

    it("accepts up to 10 rewards", () => {
      const rewards = Array.from({ length: 10 }, (_, i) => ({
        name: `Reward ${i}`,
        threshold: i + 1,
        rewardType: "flag" as const,
        rewardValue: `reward_${i}`,
      }));
      const result = projectConfigSchema.safeParse({ ...validConfig, rewards });
      expect(result.success).toBe(true);
    });

    it("accepts rate limit window '1m'", () => {
      const result = projectConfigSchema.safeParse({
        ...validConfig,
        rateLimit: { window: "1m", max: 10 },
      });
      expect(result.success).toBe(true);
    });

    it("accepts rate limit window '30s'", () => {
      const result = projectConfigSchema.safeParse({
        ...validConfig,
        rateLimit: { window: "30s", max: 10 },
      });
      expect(result.success).toBe(true);
    });

    it("accepts rate limit window '1h'", () => {
      const result = projectConfigSchema.safeParse({
        ...validConfig,
        rateLimit: { window: "1h", max: 10 },
      });
      expect(result.success).toBe(true);
    });

    it("accepts referral config with maxBumps", () => {
      const result = projectConfigSchema.safeParse({
        ...validConfig,
        referral: { enabled: true, positionBump: 3, maxBumps: 5 },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects missing mode", () => {
      const { mode: _mode, ...rest } = validConfig;
      const result = projectConfigSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects invalid mode 'unknown'", () => {
      const result = projectConfigSchema.safeParse({ ...validConfig, mode: "unknown" });
      expect(result.success).toBe(false);
    });

    it("rejects missing name", () => {
      const { name: _name, ...rest } = validConfig;
      const result = projectConfigSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects name longer than 200 characters", () => {
      const result = projectConfigSchema.safeParse({ ...validConfig, name: "A".repeat(201) });
      expect(result.success).toBe(false);
    });

    it("rejects empty name", () => {
      const result = projectConfigSchema.safeParse({ ...validConfig, name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects missing referral config", () => {
      const { referral: _ref, ...rest } = validConfig;
      const result = projectConfigSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects maxSubscribers = 0 (must be > 0)", () => {
      const result = projectConfigSchema.safeParse({ ...validConfig, maxSubscribers: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects maxSubscribers = -1", () => {
      const result = projectConfigSchema.safeParse({ ...validConfig, maxSubscribers: -1 });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer maxSubscribers", () => {
      const result = projectConfigSchema.safeParse({ ...validConfig, maxSubscribers: 1.5 });
      expect(result.success).toBe(false);
    });

    it("rejects more than 20 customFields", () => {
      const fields = Array.from({ length: 21 }, (_, i) => ({
        name: `f${i}`,
        type: "text" as const,
        label: `F${i}`,
        required: false,
      }));
      const result = projectConfigSchema.safeParse({ ...validConfig, customFields: fields });
      expect(result.success).toBe(false);
    });

    it("rejects more than 10 rewards", () => {
      const rewards = Array.from({ length: 11 }, (_, i) => ({
        name: `R${i}`,
        threshold: i + 1,
        rewardType: "flag" as const,
        rewardValue: `r${i}`,
      }));
      const result = projectConfigSchema.safeParse({ ...validConfig, rewards });
      expect(result.success).toBe(false);
    });

    it("rejects invalid rate limit window 'abc'", () => {
      const result = projectConfigSchema.safeParse({
        ...validConfig,
        rateLimit: { window: "abc", max: 10 },
      });
      expect(result.success).toBe(false);
    });

    it("rejects rate limit window without unit number ('m')", () => {
      const result = projectConfigSchema.safeParse({
        ...validConfig,
        rateLimit: { window: "m", max: 10 },
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid deduplication strategy", () => {
      const result = projectConfigSchema.safeParse({
        ...validConfig,
        deduplication: "phone",
      });
      expect(result.success).toBe(false);
    });
  });
});

// ── paginationSchema ──────────────────────────────────────────────────────────
describe("paginationSchema", () => {
  describe("defaults", () => {
    it("applies default page = 1 when page is missing", () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.page).toBe(1);
    });

    it("applies default limit = 20 when limit is missing", () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.limit).toBe(20);
    });
  });

  describe("string coercion", () => {
    it("coerces string '5' to number 5 for page", () => {
      const result = paginationSchema.safeParse({ page: "5" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.page).toBe(5);
    });

    it("coerces string '50' to number 50 for limit", () => {
      const result = paginationSchema.safeParse({ limit: "50" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.limit).toBe(50);
    });

    it("coerces numeric page correctly", () => {
      const result = paginationSchema.safeParse({ page: 3 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.page).toBe(3);
    });
  });

  describe("valid edge values", () => {
    it("accepts page = 1 (minimum)", () => {
      const result = paginationSchema.safeParse({ page: 1 });
      expect(result.success).toBe(true);
    });

    it("accepts limit = 1 (minimum)", () => {
      const result = paginationSchema.safeParse({ limit: 1 });
      expect(result.success).toBe(true);
    });

    it("accepts limit = 100 (maximum)", () => {
      const result = paginationSchema.safeParse({ limit: 100 });
      expect(result.success).toBe(true);
    });

    it("accepts large page numbers", () => {
      const result = paginationSchema.safeParse({ page: 9999 });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects page < 1", () => {
      const result = paginationSchema.safeParse({ page: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects negative page", () => {
      const result = paginationSchema.safeParse({ page: -1 });
      expect(result.success).toBe(false);
    });

    it("rejects limit > 100", () => {
      const result = paginationSchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    it("rejects limit = 0", () => {
      const result = paginationSchema.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric string for page", () => {
      const result = paginationSchema.safeParse({ page: "abc" });
      expect(result.success).toBe(false);
    });

    it("rejects non-numeric string for limit", () => {
      const result = paginationSchema.safeParse({ limit: "xyz" });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer page (float)", () => {
      const result = paginationSchema.safeParse({ page: 1.5 });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer limit (float)", () => {
      const result = paginationSchema.safeParse({ limit: 10.9 });
      expect(result.success).toBe(false);
    });
  });
});

// ── bulkActionSchema ──────────────────────────────────────────────────────────
describe("bulkActionSchema", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  describe("valid inputs", () => {
    it("accepts valid ids array with 'approve' action", () => {
      const result = bulkActionSchema.safeParse({ ids: [validUuid], action: "approve" });
      expect(result.success).toBe(true);
    });

    it("accepts 'reject' action", () => {
      const result = bulkActionSchema.safeParse({ ids: [validUuid], action: "reject" });
      expect(result.success).toBe(true);
    });

    it("accepts 'ban' action", () => {
      const result = bulkActionSchema.safeParse({ ids: [validUuid], action: "ban" });
      expect(result.success).toBe(true);
    });

    it("accepts 500 ids (maximum allowed)", () => {
      const ids = Array.from({ length: 500 }, () => validUuid);
      const result = bulkActionSchema.safeParse({ ids, action: "approve" });
      expect(result.success).toBe(true);
    });

    it("accepts multiple different valid UUIDs", () => {
      const ids = [
        "00000000-0000-0000-0000-000000000001",
        "00000000-0000-0000-0000-000000000002",
        "00000000-0000-0000-0000-000000000003",
      ];
      const result = bulkActionSchema.safeParse({ ids, action: "reject" });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects empty ids array", () => {
      const result = bulkActionSchema.safeParse({ ids: [], action: "approve" });
      expect(result.success).toBe(false);
    });

    it("rejects ids array with more than 500 items", () => {
      const ids = Array.from({ length: 501 }, () => validUuid);
      const result = bulkActionSchema.safeParse({ ids, action: "approve" });
      expect(result.success).toBe(false);
    });

    it("rejects non-UUID strings in ids", () => {
      const result = bulkActionSchema.safeParse({ ids: ["not-a-uuid"], action: "approve" });
      expect(result.success).toBe(false);
    });

    it("rejects plain numeric strings in ids", () => {
      const result = bulkActionSchema.safeParse({ ids: ["12345"], action: "approve" });
      expect(result.success).toBe(false);
    });

    it("rejects action 'delete' (not in enum)", () => {
      const result = bulkActionSchema.safeParse({ ids: [validUuid], action: "delete" });
      expect(result.success).toBe(false);
    });

    it("rejects action 'activate'", () => {
      const result = bulkActionSchema.safeParse({ ids: [validUuid], action: "activate" });
      expect(result.success).toBe(false);
    });

    it("rejects missing ids", () => {
      const result = bulkActionSchema.safeParse({ action: "approve" });
      expect(result.success).toBe(false);
    });

    it("rejects missing action", () => {
      const result = bulkActionSchema.safeParse({ ids: [validUuid] });
      expect(result.success).toBe(false);
    });
  });
});

// ── webhookEndpointSchema ─────────────────────────────────────────────────────
describe("webhookEndpointSchema", () => {
  const validBase = {
    url: "https://example.com/hook",
    secret: "a".repeat(16),
    events: ["subscriber.created"] as const,
  };

  describe("valid inputs", () => {
    it("accepts a minimal valid webhook endpoint", () => {
      const result = webhookEndpointSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it("accepts all 9 valid event types individually", () => {
      for (const event of WEBHOOK_EVENTS) {
        const result = webhookEndpointSchema.safeParse({ ...validBase, events: [event] });
        expect(result.success, `event '${event}' should be valid`).toBe(true);
      }
    });

    it("accepts multiple events in one endpoint", () => {
      const result = webhookEndpointSchema.safeParse({
        ...validBase,
        events: ["subscriber.created", "subscriber.verified", "referral.created"],
      });
      expect(result.success).toBe(true);
    });

    it("accepts all 9 events at once", () => {
      const result = webhookEndpointSchema.safeParse({
        ...validBase,
        events: [...WEBHOOK_EVENTS],
      });
      expect(result.success).toBe(true);
    });

    it("accepts secret of exactly 16 characters (minimum)", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, secret: "a".repeat(16) });
      expect(result.success).toBe(true);
    });

    it("accepts secret of exactly 128 characters (maximum)", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, secret: "a".repeat(128) });
      expect(result.success).toBe(true);
    });

    it("accepts an https URL", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, url: "https://api.example.com/webhooks" });
      expect(result.success).toBe(true);
    });

    it("accepts an http URL", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, url: "http://localhost:3000/hook" });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects a non-URL string for url", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, url: "not-a-url" });
      expect(result.success).toBe(false);
    });

    it("rejects url without protocol", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, url: "example.com/hook" });
      expect(result.success).toBe(false);
    });

    it("rejects secret shorter than 16 characters", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, secret: "tooshort" });
      expect(result.success).toBe(false);
    });

    it("rejects secret of exactly 15 characters", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, secret: "a".repeat(15) });
      expect(result.success).toBe(false);
    });

    it("rejects secret longer than 128 characters", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, secret: "a".repeat(129) });
      expect(result.success).toBe(false);
    });

    it("rejects empty events array", () => {
      const result = webhookEndpointSchema.safeParse({ ...validBase, events: [] });
      expect(result.success).toBe(false);
    });

    it("rejects an event type not in the enum", () => {
      const result = webhookEndpointSchema.safeParse({
        ...validBase,
        events: ["subscriber.deleted"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing url", () => {
      const { url: _url, ...rest } = validBase;
      const result = webhookEndpointSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing secret", () => {
      const { secret: _secret, ...rest } = validBase;
      const result = webhookEndpointSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it("rejects missing events", () => {
      const { events: _events, ...rest } = validBase;
      const result = webhookEndpointSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });
});

// ── experimentSchema ──────────────────────────────────────────────────────────
describe("experimentSchema", () => {
  const validVariants = [
    { name: "A", weight: 50 },
    { name: "B", weight: 50 },
  ];

  describe("valid inputs", () => {
    it("accepts a valid 2-variant experiment", () => {
      const result = experimentSchema.safeParse({ name: "Test", variants: validVariants });
      expect(result.success).toBe(true);
    });

    it("accepts 5 variants (maximum)", () => {
      const variants = Array.from({ length: 5 }, (_, i) => ({ name: String(i), weight: 20 }));
      const result = experimentSchema.safeParse({ name: "Big Test", variants });
      expect(result.success).toBe(true);
    });

    it("accepts weight = 0 (minimum)", () => {
      const result = experimentSchema.safeParse({
        name: "T",
        variants: [{ name: "A", weight: 0 }, { name: "B", weight: 100 }],
      });
      expect(result.success).toBe(true);
    });

    it("accepts weight = 100 (maximum)", () => {
      const result = experimentSchema.safeParse({
        name: "T",
        variants: [{ name: "A", weight: 100 }, { name: "B", weight: 0 }],
      });
      expect(result.success).toBe(true);
    });

    it("accepts 3 variants", () => {
      const result = experimentSchema.safeParse({
        name: "Three-way",
        variants: [
          { name: "A", weight: 33 },
          { name: "B", weight: 33 },
          { name: "C", weight: 34 },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects fewer than 2 variants", () => {
      const result = experimentSchema.safeParse({
        name: "Bad",
        variants: [{ name: "A", weight: 100 }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty variants array", () => {
      const result = experimentSchema.safeParse({ name: "Bad", variants: [] });
      expect(result.success).toBe(false);
    });

    it("rejects more than 5 variants", () => {
      const variants = Array.from({ length: 6 }, (_, i) => ({ name: String(i), weight: 16 }));
      const result = experimentSchema.safeParse({ name: "Too Many", variants });
      expect(result.success).toBe(false);
    });

    it("rejects weight > 100", () => {
      const result = experimentSchema.safeParse({
        name: "Bad",
        variants: [{ name: "A", weight: 101 }, { name: "B", weight: 0 }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects weight < 0", () => {
      const result = experimentSchema.safeParse({
        name: "Bad",
        variants: [{ name: "A", weight: -1 }, { name: "B", weight: 100 }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing experiment name", () => {
      const result = experimentSchema.safeParse({ variants: validVariants });
      expect(result.success).toBe(false);
    });

    it("rejects empty experiment name", () => {
      const result = experimentSchema.safeParse({ name: "", variants: validVariants });
      expect(result.success).toBe(false);
    });

    it("rejects missing variant name", () => {
      const result = experimentSchema.safeParse({
        name: "T",
        variants: [{ weight: 50 }, { name: "B", weight: 50 }],
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty variant name", () => {
      const result = experimentSchema.safeParse({
        name: "T",
        variants: [{ name: "", weight: 50 }, { name: "B", weight: 50 }],
      });
      expect(result.success).toBe(false);
    });
  });
});

// ── rewardTierConfigSchema ────────────────────────────────────────────────────
describe("rewardTierConfigSchema", () => {
  const validTier = {
    name: "Early Access",
    threshold: 3,
    rewardType: "flag" as const,
    rewardValue: "early_access",
  };

  describe("valid inputs", () => {
    it("accepts a valid flag reward tier", () => {
      const result = rewardTierConfigSchema.safeParse(validTier);
      expect(result.success).toBe(true);
    });

    it("accepts rewardType 'code'", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, rewardType: "code" });
      expect(result.success).toBe(true);
    });

    it("accepts rewardType 'custom'", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, rewardType: "custom" });
      expect(result.success).toBe(true);
    });

    it("accepts threshold = 1 (minimum)", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, threshold: 1 });
      expect(result.success).toBe(true);
    });

    it("accepts a long rewardValue (up to 500 chars)", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, rewardValue: "v".repeat(500) });
      expect(result.success).toBe(true);
    });

    it("accepts a long name (up to 100 chars)", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, name: "N".repeat(100) });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects threshold < 1", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, threshold: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects negative threshold", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, threshold: -1 });
      expect(result.success).toBe(false);
    });

    it("rejects non-integer threshold", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, threshold: 1.5 });
      expect(result.success).toBe(false);
    });

    it("rejects invalid rewardType", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, rewardType: "discount" });
      expect(result.success).toBe(false);
    });

    it("rejects empty rewardValue", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, rewardValue: "" });
      expect(result.success).toBe(false);
    });

    it("rejects rewardValue longer than 500 chars", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, rewardValue: "v".repeat(501) });
      expect(result.success).toBe(false);
    });

    it("rejects empty name", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, name: "" });
      expect(result.success).toBe(false);
    });

    it("rejects name longer than 100 chars", () => {
      const result = rewardTierConfigSchema.safeParse({ ...validTier, name: "N".repeat(101) });
      expect(result.success).toBe(false);
    });

    it("rejects missing threshold", () => {
      const { threshold: _t, ...rest } = validTier;
      const result = rewardTierConfigSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });
  });
});

// ── timeRangeSchema ───────────────────────────────────────────────────────────
describe("timeRangeSchema", () => {
  describe("valid inputs", () => {
    it("accepts valid ISO date strings", () => {
      const result = timeRangeSchema.safeParse({
        from: "2024-01-01T00:00:00.000Z",
        to: "2024-12-31T23:59:59.999Z",
      });
      expect(result.success).toBe(true);
    });

    it("coerces string dates to Date objects", () => {
      const result = timeRangeSchema.safeParse({
        from: "2024-01-01",
        to: "2024-06-30",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.from).toBeInstanceOf(Date);
        expect(result.data.to).toBeInstanceOf(Date);
      }
    });

    it("accepts Date objects directly", () => {
      const result = timeRangeSchema.safeParse({
        from: new Date("2024-01-01"),
        to: new Date("2024-12-31"),
      });
      expect(result.success).toBe(true);
    });

    it("accepts timestamp numbers (coerce.date behaviour)", () => {
      const result = timeRangeSchema.safeParse({
        from: 1704067200000,
        to: 1735603200000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("invalid inputs", () => {
    it("rejects non-date strings", () => {
      const result = timeRangeSchema.safeParse({ from: "not-a-date", to: "also-not-a-date" });
      expect(result.success).toBe(false);
    });

    it("rejects missing 'from' field", () => {
      const result = timeRangeSchema.safeParse({ to: "2024-12-31" });
      expect(result.success).toBe(false);
    });

    it("rejects missing 'to' field", () => {
      const result = timeRangeSchema.safeParse({ from: "2024-01-01" });
      expect(result.success).toBe(false);
    });

    it("z.coerce.date() accepts null (coerces to epoch) — documents real Zod behaviour", () => {
      // z.coerce.date() calls new Date(null) which equals new Date(0) — this is valid
      const result = timeRangeSchema.safeParse({ from: null, to: null });
      expect(result.success).toBe(true);
    });

    it("rejects random text strings", () => {
      const result = timeRangeSchema.safeParse({ from: "yesterday", to: "tomorrow" });
      expect(result.success).toBe(false);
    });
  });
});
