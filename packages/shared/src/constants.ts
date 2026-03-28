export const REFERRAL_CODE_LENGTH = 8;
export const API_KEY_PREFIX = "wl_pk_";
export const API_SECRET_PREFIX = "wl_sk_";

export const WEBHOOK_EVENTS = [
  "subscriber.created", "subscriber.verified", "subscriber.approved", "subscriber.rejected",
  "referral.created", "reward.unlocked", "position.changed", "experiment.assigned", "waitlist.milestone",
] as const;

export const SHARE_CHANNELS = ["twitter", "facebook", "linkedin", "whatsapp", "email", "copy", "other"] as const;

export const WEBHOOK_MAX_RETRIES = 5;
export const WEBHOOK_RETRY_DELAYS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];

export const DISPOSABLE_EMAIL_DOMAINS = [
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com", "grr.la",
  "dispostable.com", "trashmail.com",
];

export const ANALYTICS_CACHE_TTL = 300;
export const LEADERBOARD_CACHE_TTL = 60;
