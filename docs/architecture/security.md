# Security

This document covers every security mechanism in the system, how each works at the code level, and best practices for production deployment.

---

## API Key Authentication

### Flow

1. Client sends `X-API-Key: wl_pk_<32 chars>` header.
2. The `apiKeyAuth` middleware (in `apps/api/src/middleware/api-key.ts`) hashes the incoming key with SHA-256.
3. The hash is looked up in `projects.api_key_hash`.
4. On match, the project row is attached to `request.project` for downstream handlers.

### Implementation

```typescript
// middleware/api-key.ts
import { createHash } from "node:crypto";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function apiKeyAuth(db: Database) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const apiKey = request.headers["x-api-key"] as string | undefined;
    if (!apiKey) {
      return reply.status(401).send({ error: "Missing X-API-Key header" });
    }

    const hash = hashApiKey(apiKey);
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.apiKeyHash, hash))
      .limit(1);

    if (!project) {
      return reply.status(401).send({ error: "Invalid API key" });
    }

    request.project = project;
  };
}
```

### Key Hashing Rationale

- The database query always uses `api_key_hash`, never the plain key.
- The plain `api_key` column exists only so it can be displayed to the admin once at project creation. It plays no role in authentication.
- SHA-256 is a one-way function: even with full database access, an attacker cannot recover plain-text keys from hashes.
- Because API keys have 62^32 ≈ 10^57 combinations (nanoid 32-char base-62), brute-forcing the hash is computationally infeasible.

---

## Admin JWT Authentication

### Flow

1. Admin calls `POST /api/v1/admin/auth/login` with email and password.
2. Server verifies password by hashing with SHA-256 and comparing to `admin_users.password_hash`.
3. On success, a JWT is signed using the `ADMIN_JWT_SECRET` environment variable via `@fastify/jwt`.
4. Admin sends `Authorization: Bearer <jwt>` on all subsequent admin requests.
5. The `authenticateAdmin` decorator (registered in `middleware/jwt.ts`) calls `request.jwtVerify()`.

### Implementation

```typescript
// middleware/jwt.ts
export async function registerJwt(app: FastifyInstance, secret: string) {
  await app.register(fjwt, { secret });

  app.decorate("authenticateAdmin", async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({ error: "Unauthorized" });
    }
  });
}
```

JWT payload shape:
```json
{
  "sub": "<admin-user-uuid>",
  "email": "admin@example.com",
  "iat": 1711800000
}
```

### Password Hashing

Passwords are hashed with SHA-256 (not bcrypt/argon2). For production deployments handling sensitive data, consider upgrading to bcrypt or Argon2 with a salt. The current implementation is sufficient for a single-admin internal tool, but not for user-facing authentication.

---

## Webhook HMAC-SHA256 Signing

Every webhook delivery includes the header `X-Webhook-Signature: sha256=<hex>`. The signature is computed over the raw JSON body string.

### Signing (server side)

```typescript
// services/webhook.ts
import { createHmac } from "node:crypto";

export function signPayload(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${hmac}`;
}
```

### Verification (receiver side)

```typescript
import { timingSafeEqual } from "node:crypto";

export function verifySignature(payload: string, secret: string, signature: string): boolean {
  const expected = signPayload(payload, secret);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
```

`timingSafeEqual` compares buffers in constant time regardless of where they differ, preventing timing side-channel attacks that could leak information about partial matches.

If no secret is configured on an endpoint (`secret` is null), the signature is computed against an empty string (`endpoint.secret ?? ""`), making it essentially unsigned — strongly discourage this in production.

---

## Rate Limiting

Global rate limit registered in `server.ts`:

```typescript
await app.register(rateLimit, { max: 100, timeWindow: "1 minute", redis });
```

- **100 requests per minute per IP** across all routes.
- Backed by Redis — survives restarts and works across multiple instances.
- Returns HTTP `429` with `Retry-After` header on violation.

Per-project rate limiting (from `config.rateLimit`) is defined in the schema but not yet enforced at the route level — this is a planned extension point. The global rate limit is the current enforcement mechanism.

---

## Input Validation (Zod Schemas)

All request bodies and query parameters are validated with Zod before any business logic runs. Errors return HTTP `400` with structured field-level details:

```json
{
  "error": "Validation failed",
  "details": {
    "email": ["Invalid email address"],
    "referralCode": ["Invalid referral code"]
  }
}
```

Key validation rules:

| Field | Rule |
|---|---|
| `email` | `z.string().email()` |
| `referralCode` | `/^[a-zA-Z0-9]{6,12}$/` |
| `channel` | Enum of 7 allowed values |
| `webhook.url` | `z.string().url()` |
| `webhook.secret` | `z.string().min(16).max(128)` |
| `admin.password` | `z.string().min(8)` |
| `pagination.limit` | `z.coerce.number().int().min(1).max(100)` |
| `bulk.ids` | `z.array(z.string().uuid()).min(1).max(500)` |

---

## CORS Configuration

CORS is configured globally in `server.ts`:

```typescript
const corsOrigins = process.env.CORS_ORIGINS?.split(",") ?? ["*"];
await app.register(cors, { origin: corsOrigins });
```

- In development (Docker Compose default): `http://localhost:3400,http://localhost:5173`
- In production: set `CORS_ORIGINS` to a comma-separated list of allowed origins.
- Default fallback `["*"]` allows all origins — **override this in production**.

---

## Fraud Prevention Measures

### Disposable Email Detection

```typescript
isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? DISPOSABLE_EMAIL_DOMAINS.includes(domain) : false;
}
```

Blocked domains (from `packages/shared/src/constants.ts`):
`mailinator.com`, `guerrillamail.com`, `tempmail.com`, `throwaway.email`, `yopmail.com`, `sharklasers.com`, `guerrillamailblock.com`, `grr.la`, `dispostable.com`, `trashmail.com`

This list is intentionally small and hardcoded — extend it by adding to `DISPOSABLE_EMAIL_DOMAINS`.

### Self-Referral Detection

```typescript
isSelfReferral(referrerEmail: string, referredEmail: string): boolean {
  return referrerEmail.toLowerCase() === referredEmail.toLowerCase();
}
```

Prevents a user from signing up with a variation of their own email to boost their referral count.

### Same-IP Detection

```typescript
async isSameIpRecent(projectId, ip, windowMs = 3_600_000): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  // COUNT subscribers from same IP in past hour
}
```

Detects multiple signups from the same IP within 1 hour. Can be used to reject or flag suspicious referrals.

### Database-Level Deduplication

The unique index `subscribers_project_email_idx` on `(project_id, email)` prevents the same email from registering twice in the same project at the database level — regardless of application logic.

The unique index `referrals_referred_id_idx` on `(referred_id)` prevents a subscriber from being credited as a referral more than once.

---

## Best Practices for Production Deployment

### Required Environment Variables

| Variable | Minimum | Notes |
|---|---|---|
| `ADMIN_JWT_SECRET` | 32+ characters | Use `openssl rand -hex 32` |
| `DATABASE_URL` | — | Use SSL: `?sslmode=require` |
| `REDIS_URL` | — | Use a password-protected Redis |

### API Keys

- Rotate API keys by creating a new project or by re-generating through an admin endpoint.
- Never log the plain-text `api_key` value (it is returned only once at creation).
- The `api_key_hash` in the database can be stored safely in logs.

### Webhook Secrets

- Minimum 16 characters (enforced by Zod); use at least 32 random bytes.
- Generate with: `openssl rand -hex 32`
- Rotate by deleting and re-creating the webhook endpoint.

### CORS

- Set `CORS_ORIGINS` explicitly. Do not use `*` in production.
- Include only the exact origins your frontend app runs on.

### Rate Limiting

- The global 100 req/min limit applies per IP. Behind a reverse proxy (nginx, Cloudflare), ensure the real client IP is forwarded via `X-Forwarded-For` and that Fastify trusts the proxy.
- Add `app.register(fastifyForwardedIp)` or configure `trustProxy: true` in Fastify options.

### Database

- Use `sslmode=require` in `DATABASE_URL`.
- Create a dedicated database user with only the permissions the app needs (SELECT, INSERT, UPDATE, DELETE on specific tables; no DROP/CREATE).
- Enable connection pooling (PgBouncer) for horizontal scaling.

### Admin Access

- The admin setup endpoint (`POST /api/v1/admin/auth/setup`) only works once. After the first admin is created, it returns 409 permanently.
- Consider restricting the `/api/v1/admin/*` routes to an internal network or VPN in production.
- JWT tokens do not expire by default with `@fastify/jwt` unless you add `{ expiresIn: "1d" }` to `app.jwt.sign()`. Add expiry in production.

### Container Security

- The Dockerfile runs as a non-root user (`waitlist`, UID 1001).
- `dumb-init` is used as PID 1 to handle signals correctly.
- The production stage copies only compiled artifacts, not source code.
