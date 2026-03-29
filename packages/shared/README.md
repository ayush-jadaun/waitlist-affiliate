# @waitlist/shared

Internal shared package containing TypeScript types, Zod validation schemas, and constants used across the monorepo. Not published to npm.

## Usage

```ts
import { type SubscribeRequest, subscribeSchema, WEBHOOK_EVENTS } from "@waitlist/shared";
```

## Exports

### Types

| Type                      | Description                                                 |
|---------------------------|-------------------------------------------------------------|
| `WaitlistMode`            | `"prelaunch" \| "gated" \| "viral"`                       |
| `SubscriberStatus`        | `"waiting" \| "pending" \| "approved" \| "rejected" \| "active" \| "banned"` |
| `RewardType`              | `"flag" \| "code" \| "custom"`                            |
| `DeduplicationStrategy`   | `"email" \| "email+ip"`                                   |
| `FieldDefinition`         | Custom signup field definition (name, type, label, required, options) |
| `ReferralConfig`          | Referral feature config (enabled, positionBump, maxBumps) |
| `RateLimitConfig`         | Rate limit config (window, max)                           |
| `ProjectConfig`           | Full project configuration object                         |
| `RewardTierConfig`        | Reward tier definition (name, threshold, rewardType, rewardValue) |
| `SubscribeRequest`        | Payload for `POST /api/v1/subscribe`                      |
| `SubscribeResponse`       | Response from `POST /api/v1/subscribe`                    |
| `SubscriberStatusResponse`| Response from `GET /api/v1/subscribe/:email/status`       |
| `LeaderboardEntry`        | Single leaderboard row (rank, name, referralCount)        |
| `PublicStats`             | Public stats response (totalSignups, spotsRemaining, referralsMade) |
| `WebhookEvent`            | Webhook event envelope                                    |
| `AnalyticsOverview`       | Analytics overview metrics                                |
| `TimeseriesPoint`         | Daily analytics data point                                |
| `CohortRow`               | Cohort analysis row                                       |
| `ChannelStats`            | Per-channel referral stats                                |

### Zod Schemas

| Schema                  | Validates                                          |
|-------------------------|----------------------------------------------------|
| `subscribeSchema`       | Subscribe request body                             |
| `fieldDefinitionSchema` | Custom field definition                            |
| `referralConfigSchema`  | Referral configuration                             |
| `rateLimitConfigSchema` | Rate limit configuration (e.g. `"1m"`, `"30s"`)   |
| `rewardTierConfigSchema`| Reward tier configuration                          |
| `projectConfigSchema`   | Full project configuration                         |
| `paginationSchema`      | Pagination query params (page, limit)              |
| `timeRangeSchema`       | Date range query params (from, to)                 |
| `bulkActionSchema`      | Bulk subscriber action (ids, action)               |
| `webhookEndpointSchema` | Webhook endpoint configuration                     |
| `experimentSchema`      | A/B experiment definition                          |

### Constants

| Constant                   | Value / Description                                         |
|----------------------------|-------------------------------------------------------------|
| `REFERRAL_CODE_LENGTH`     | `8` — length of generated referral codes                   |
| `API_KEY_PREFIX`           | `"wl_pk_"` — public API key prefix                        |
| `API_SECRET_PREFIX`        | `"wl_sk_"` — secret key prefix                            |
| `WEBHOOK_EVENTS`           | Tuple of all valid webhook event type strings              |
| `SHARE_CHANNELS`           | Tuple of all valid referral share channel strings          |
| `WEBHOOK_MAX_RETRIES`      | `5` — maximum webhook delivery attempts                    |
| `WEBHOOK_RETRY_DELAYS`     | `[60s, 5m, 30m, 2h, 12h]` in milliseconds                 |
| `DISPOSABLE_EMAIL_DOMAINS` | Blocklist of known disposable email providers              |
| `ANALYTICS_CACHE_TTL`      | `300` seconds (5 minutes)                                  |
| `LEADERBOARD_CACHE_TTL`    | `60` seconds (1 minute)                                    |

## Note

This is an internal workspace package (`"@waitlist/shared": "workspace:*"`). It is consumed by `@waitlist/sdk`, `@waitlist/react`, `@waitlist/widget`, and `@waitlist/api`. It is not intended to be published to the npm registry.
