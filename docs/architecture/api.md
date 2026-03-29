# API Reference

Base URL: `http://localhost:3400` (development) / your production domain.

All requests and responses use `Content-Type: application/json`.

---

## Authentication

### API Key (Public Endpoints)

Public endpoints require an `X-API-Key` header containing the project's API key (the `wl_pk_` prefixed value returned when a project is created).

**How it works:** The middleware hashes the incoming key with SHA-256 and looks up the `api_key_hash` column in `projects`. The plain-text key is never stored in a WHERE clause.

```
X-API-Key: wl_pk_<32 nanoid chars>
```

If the header is missing:
```json
{ "error": "Missing X-API-Key header" }
```
HTTP `401`.

If the key is invalid:
```json
{ "error": "Invalid API key" }
```
HTTP `401`.

### JWT (Admin Endpoints)

Admin endpoints require a Bearer JWT in the `Authorization` header. Obtain a token via `POST /api/v1/admin/auth/login`.

```
Authorization: Bearer <jwt>
```

If the token is missing or invalid:
```json
{ "error": "Unauthorized" }
```
HTTP `401`.

---

## Rate Limiting

Global rate limit: **100 requests per minute per IP**, backed by Redis. Applies to all routes.

On limit exceeded, Fastify returns HTTP `429` with a standard `Retry-After` header.

---

## Error Response Format

All error responses follow the same shape:

```typescript
interface ErrorResponse {
  error: string;           // Human-readable message
  details?: Record<string, string[]>; // Zod field errors (validation failures only)
}
```

### Common Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Created |
| `204` | No content (DELETE) |
| `400` | Validation error |
| `401` | Missing or invalid auth |
| `404` | Resource not found |
| `409` | Conflict (duplicate or limit reached) |
| `429` | Rate limit exceeded |
| `503` | Server shutting down |

---

## Pagination Format

Paginated responses include a `pagination` object:

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;    // Current page (1-based)
    limit: number;   // Items per page (1–100, default 20)
    total: number;   // Total matching records
    pages: number;   // Total pages = ceil(total / limit)
  };
}
```

Query parameters: `?page=1&limit=20`

---

## Public Endpoints

### Health Check

#### `GET /health`

No authentication required.

**Response `200`:**
```json
{ "status": "ok" }
```

---

### Subscribe

#### `POST /api/v1/subscribe`

Add a new subscriber to the waitlist. Returns the existing record (HTTP 200) if the email is already registered.

**Authentication:** API Key

**Request Headers:**
```
X-API-Key: wl_pk_...
Content-Type: application/json
```

**Request Body:**
```typescript
interface SubscribeRequest {
  email: string;           // Required. Valid email address.
  name?: string;           // Optional. Max 200 chars.
  referralCode?: string;   // Optional. 6–12 alphanumeric chars. Ignored if referral.enabled=false.
  metadata?: Record<string, unknown>; // Optional. Stored in subscribers.metadata.
  channel?: "twitter" | "facebook" | "linkedin" | "whatsapp" | "email" | "copy" | "other";
}
```

**Response `201` (new subscriber):**
```typescript
interface SubscribeResponse {
  id: string;              // UUID
  email: string;
  position: number | null; // null in gated mode
  referralCode: string;    // 8-character alphanumeric code
  status: "waiting" | "pending" | "active";
  totalSignups: number;    // Total subscribers in this project
}
```

**Response `200` (existing subscriber):**
Same shape as `201` but for the existing record.

**Response `409`:**
```json
{ "error": "Waitlist is full" }
```
Returned when `config.maxSubscribers` is set and reached.

**Example:**
```bash
curl -X POST http://localhost:3400/api/v1/subscribe \
  -H "X-API-Key: wl_pk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "name": "Jane Doe",
    "referralCode": "ABC12345",
    "channel": "twitter"
  }'
```

**Example Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "jane@example.com",
  "position": 42,
  "referralCode": "XyZ98765",
  "status": "waiting",
  "totalSignups": 1337
}
```

---

#### `GET /api/v1/subscribe/:email/status`

Get the current status of a subscriber by email.

**Authentication:** API Key

**Path Parameters:**
- `email` — URL-encoded email address

**Response `200`:**
```typescript
interface SubscriberStatusResponse {
  position: number | null;
  referralCount: number;
  referralCode: string;
  rewards: string[];       // Names of unlocked reward tiers
  status: "waiting" | "pending" | "approved" | "rejected" | "active" | "banned";
}
```

**Response `404`:**
```json
{ "error": "Subscriber not found" }
```

**Example:**
```bash
curl "http://localhost:3400/api/v1/subscribe/jane%40example.com/status" \
  -H "X-API-Key: wl_pk_abc123..."
```

**Example Response:**
```json
{
  "position": 38,
  "referralCount": 4,
  "referralCode": "XyZ98765",
  "rewards": ["Early Adopter Badge", "Beta Access"],
  "status": "waiting"
}
```

---

### Stats

#### `GET /api/v1/stats`

Public-facing waitlist statistics. Response is cached in Redis for 300 seconds.

**Authentication:** API Key

**Response `200`:**
```typescript
interface PublicStats {
  totalSignups: number;
  spotsRemaining: number | null; // null if no maxSubscribers configured
  referralsMade: number;
}
```

**Example:**
```bash
curl http://localhost:3400/api/v1/stats \
  -H "X-API-Key: wl_pk_abc123..."
```

**Example Response:**
```json
{
  "totalSignups": 1337,
  "spotsRemaining": 663,
  "referralsMade": 412
}
```

---

### Leaderboard

#### `GET /api/v1/leaderboard`

Top referrers by referral count. Response is cached in Redis for 60 seconds.

**Authentication:** API Key

**Query Parameters:**
- `limit` — Number of entries (default `10`, max `100`)

**Response `200`:**
```typescript
type LeaderboardResponse = Array<{
  rank: number;
  name: string | null;
  referralCount: number;
}>;
```

**Example:**
```bash
curl "http://localhost:3400/api/v1/leaderboard?limit=5" \
  -H "X-API-Key: wl_pk_abc123..."
```

**Example Response:**
```json
[
  { "rank": 1, "name": "Alice", "referralCount": 47 },
  { "rank": 2, "name": "Bob",   "referralCount": 31 },
  { "rank": 3, "name": null,    "referralCount": 28 }
]
```

---

## Admin Endpoints

All admin endpoints require `Authorization: Bearer <jwt>`.

---

### Admin Auth

#### `POST /api/v1/admin/auth/setup`

First-time admin user creation. Fails with `409` if any admin already exists.

**Authentication:** None

**Request Body:**
```typescript
interface AdminAuthRequest {
  email: string;     // Valid email
  password: string;  // Min 8 characters
}
```

**Response `201`:**
```json
{ "token": "<jwt>" }
```

**Response `409`:**
```json
{ "error": "Admin already exists" }
```

**Example:**
```bash
curl -X POST http://localhost:3400/api/v1/admin/auth/setup \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "securepass123"}'
```

---

#### `POST /api/v1/admin/auth/login`

Exchange credentials for a JWT.

**Authentication:** None

**Request Body:**
```typescript
interface AdminAuthRequest {
  email: string;
  password: string;
}
```

**Response `200`:**
```json
{ "token": "<jwt>" }
```

**Response `401`:**
```json
{ "error": "Invalid credentials" }
```

**Example:**
```bash
curl -X POST http://localhost:3400/api/v1/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "securepass123"}'
```

---

### Admin Projects

#### `GET /api/v1/admin/project`

List all projects.

**Authentication:** JWT

**Response `200`:** Array of project rows.

**Example:**
```bash
curl http://localhost:3400/api/v1/admin/project \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `POST /api/v1/admin/project`

Create a new project with an API key.

**Authentication:** JWT

**Request Body:** Full `ProjectConfig`:
```typescript
interface ProjectConfig {
  mode: "prelaunch" | "gated" | "viral";
  name: string;                    // 1–200 chars
  maxSubscribers?: number;         // Optional cap
  requireEmailVerification: boolean;
  customFields?: FieldDefinition[]; // Max 20 fields
  referral: {
    enabled: boolean;
    positionBump: number;          // 0–100, default 1
    maxBumps?: number;             // Optional cap
  };
  rewards: RewardTierConfig[];     // Max 10 tiers
  deduplication: "email" | "email+ip";
  rateLimit: {
    window: string;  // e.g. "1m", "30s", "1h"
    max: number;     // 1–10000
  };
}
```

**Response `201`:** Project row including plain-text `apiKey` (shown only once):
```json
{
  "id": "...",
  "name": "My Product Launch",
  "mode": "prelaunch",
  "apiKey": "wl_pk_abc123...",
  "apiKeyHash": "...",
  "config": { ... },
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Example:**
```bash
curl -X POST http://localhost:3400/api/v1/admin/project \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "prelaunch",
    "name": "My Product Launch",
    "requireEmailVerification": false,
    "referral": { "enabled": true, "positionBump": 5 },
    "rewards": [],
    "deduplication": "email",
    "rateLimit": { "window": "1m", "max": 10 }
  }'
```

---

#### `PUT /api/v1/admin/project/:id`

Update a project's configuration (partial update — fields are merged).

**Authentication:** JWT

**Path Parameters:**
- `id` — Project UUID

**Request Body:** Partial `ProjectConfig` (any subset of fields)

**Response `200`:** Updated project row.

**Response `404`:**
```json
{ "error": "Project not found" }
```

---

### Admin Subscribers

#### `GET /api/v1/admin/subscribers`

Paginated list of subscribers for a project with optional filtering.

**Authentication:** JWT

**Query Parameters:**
- `projectId` — UUID (required)
- `page` — default `1`
- `limit` — default `20`, max `100`
- `status` — filter by status string
- `search` — case-insensitive email substring match (ILIKE)

**Response `200`:**
```typescript
interface SubscriberListResponse {
  data: SubscriberRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
```

**Example:**
```bash
curl "http://localhost:3400/api/v1/admin/subscribers?projectId=<uuid>&status=pending&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `PATCH /api/v1/admin/subscribers/:id`

Update a single subscriber's status.

**Authentication:** JWT

**Path Parameters:**
- `id` — Subscriber UUID

**Request Body:**
```typescript
interface PatchSubscriberRequest {
  status: "waiting" | "approved" | "rejected" | "banned";
}
```

**Response `200`:** Updated subscriber row.

**Response `404`:**
```json
{ "error": "Subscriber not found" }
```

**Example:**
```bash
curl -X PATCH http://localhost:3400/api/v1/admin/subscribers/<uuid> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved"}'
```

---

#### `POST /api/v1/admin/subscribers/bulk`

Bulk status update for up to 500 subscribers.

**Authentication:** JWT

**Request Body:**
```typescript
interface BulkActionRequest {
  ids: string[];   // Array of subscriber UUIDs (1–500)
  action: "approve" | "reject" | "ban";
}
```

**Response `200`:**
```json
{ "updated": 42 }
```

**Example:**
```bash
curl -X POST http://localhost:3400/api/v1/admin/subscribers/bulk \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids": ["<uuid1>", "<uuid2>"], "action": "approve"}'
```

---

### Admin Rewards

#### `GET /api/v1/admin/rewards`

List reward tiers for a project ordered by `sort_order`.

**Authentication:** JWT

**Query Parameters:**
- `projectId` — UUID (required)

**Response `200`:** Array of reward tier rows.

---

#### `POST /api/v1/admin/rewards`

Create a reward tier.

**Authentication:** JWT

**Request Body:**
```typescript
interface CreateRewardRequest {
  projectId: string;
  name: string;              // 1–100 chars
  threshold: number;         // Min 1 verified referrals required
  rewardType: "flag" | "code" | "custom";
  rewardValue: string;       // 1–500 chars
  sortOrder?: number;        // default 0
}
```

**Response `201`:** Created tier row.

---

#### `PUT /api/v1/admin/rewards/:id`

Update a reward tier (partial).

**Authentication:** JWT

**Response `200`:** Updated tier row.

**Response `404`:**
```json
{ "error": "Reward tier not found" }
```

---

#### `DELETE /api/v1/admin/rewards/:id`

Delete a reward tier.

**Authentication:** JWT

**Response `204`:** No content.

**Response `404`:**
```json
{ "error": "Reward tier not found" }
```

---

### Admin Webhooks

#### `GET /api/v1/admin/webhooks`

List all webhook endpoints for a project.

**Authentication:** JWT

**Query Parameters:**
- `projectId` — UUID (required)

**Response `200`:** Array of webhook endpoint rows.

---

#### `POST /api/v1/admin/webhooks`

Register a new webhook endpoint.

**Authentication:** JWT

**Request Body:**
```typescript
interface CreateWebhookRequest {
  projectId: string;
  url: string;        // Valid URL
  secret: string;     // 16–128 chars; used for HMAC signature
  events: Array<
    | "subscriber.created" | "subscriber.verified"
    | "subscriber.approved" | "subscriber.rejected"
    | "referral.created" | "reward.unlocked"
    | "position.changed" | "experiment.assigned"
    | "waitlist.milestone"
  >;
}
```

**Response `201`:** Created endpoint row.

**Example:**
```bash
curl -X POST http://localhost:3400/api/v1/admin/webhooks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "<uuid>",
    "url": "https://myapp.com/webhooks/waitlist",
    "secret": "my-super-secret-32-chars-minimum",
    "events": ["subscriber.created", "referral.created", "reward.unlocked"]
  }'
```

---

#### `DELETE /api/v1/admin/webhooks/:id`

Delete a webhook endpoint and all its delivery history.

**Authentication:** JWT

**Response `204`:** No content.

**Response `404`:**
```json
{ "error": "Webhook endpoint not found" }
```

---

#### `GET /api/v1/admin/webhooks/:id/deliveries`

Paginated delivery history for a specific endpoint.

**Authentication:** JWT

**Query Parameters:**
- `page` — default `1`
- `limit` — default `20`, max `100`

**Response `200`:** Paginated array of `webhook_deliveries` rows.

---

### Admin Experiments

#### `GET /api/v1/admin/experiments`

List experiments for a project.

**Authentication:** JWT

**Query Parameters:**
- `projectId` — UUID (required)

**Response `200`:** Array of experiment rows.

---

#### `POST /api/v1/admin/experiments`

Create an A/B experiment.

**Authentication:** JWT

**Request Body:**
```typescript
interface CreateExperimentRequest {
  projectId: string;
  name: string;        // 1–200 chars
  variants: Array<{
    name: string;      // 1–100 chars
    weight: number;    // 0–100; weights should sum to 100
  }>;                  // 2–5 variants
}
```

**Response `201`:** Created experiment row.

---

#### `PATCH /api/v1/admin/experiments/:id`

Toggle the `active` flag on an experiment.

**Authentication:** JWT

**Response `200`:** Updated experiment row with flipped `active`.

**Response `404`:**
```json
{ "error": "Experiment not found" }
```

---

#### `DELETE /api/v1/admin/experiments/:id`

Delete an experiment and all its assignments.

**Authentication:** JWT

**Response `204`:** No content.

---

### Admin Analytics

#### `GET /api/v1/admin/analytics/overview`

High-level metrics for a project. Cached in Redis for 300 seconds.

**Authentication:** JWT

**Query Parameters:**
- `projectId` — UUID (required)

**Response `200`:**
```typescript
interface AnalyticsOverview {
  totalSignups: number;
  todaySignups: number;
  totalReferrals: number;
  todayReferrals: number;
  conversionRate: number;  // totalReferrals / totalSignups, rounded to 4 dp
  kFactor: number;         // same calculation as conversionRate at this endpoint
}
```

**Example:**
```bash
curl "http://localhost:3400/api/v1/admin/analytics/overview?projectId=<uuid>" \
  -H "Authorization: Bearer $TOKEN"
```

**Example Response:**
```json
{
  "totalSignups": 1337,
  "todaySignups": 47,
  "totalReferrals": 412,
  "todayReferrals": 18,
  "conversionRate": 0.3082,
  "kFactor": 0.3082
}
```

---

#### `GET /api/v1/admin/analytics/timeseries`

Daily time-series data from `analytics_daily`.

**Authentication:** JWT

**Query Parameters:**
- `projectId` — UUID (required)
- `from` — ISO date/datetime (coerced to Date)
- `to` — ISO date/datetime (coerced to Date)

**Response `200`:** Array of `analytics_daily` rows ordered by `date` ascending.

**Example:**
```bash
curl "http://localhost:3400/api/v1/admin/analytics/timeseries?projectId=<uuid>&from=2025-01-01&to=2025-03-31" \
  -H "Authorization: Bearer $TOKEN"
```

---

#### `GET /api/v1/admin/analytics/cohorts`

Weekly cohort analysis data.

**Authentication:** JWT

**Query Parameters:**
- `projectId` — UUID (required)

**Response `200`:** Array of `analytics_cohorts` rows ordered by `cohort_week` ascending.

---

#### `GET /api/v1/admin/analytics/channels`

Referral counts broken down by share channel.

**Authentication:** JWT

**Query Parameters:**
- `projectId` — UUID (required)

**Response `200`:**
```typescript
type ChannelBreakdown = Array<{
  channel: string | null;
  count: number;
}>;
```

**Example Response:**
```json
[
  { "channel": "twitter",  "count": 210 },
  { "channel": "copy",     "count": 98  },
  { "channel": "facebook", "count": 54  }
]
```
