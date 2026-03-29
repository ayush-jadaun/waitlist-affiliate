# Next.js Complete Integration Example

A complete Next.js App Router application demonstrating every feature of the
Waitlist & Viral Referral System: landing page with sign-up form, referral
status page, and a Next.js Route Handler for webhook processing.

## Structure

```
app/
  layout.tsx           — Root layout with WaitlistProvider
  page.tsx             — Landing page with WaitlistForm
  status/
    page.tsx           — Referral status page (check position + rewards)
  api/
    webhook/
      route.ts         — Webhook Route Handler (HMAC-SHA256 verified)
```

## Quick start

### 1. Prerequisites

- Node.js 18+
- pnpm (or npm / yarn)
- The waitlist API server running (see root README)

### 2. Install dependencies

```bash
pnpm add @waitlist/react @waitlist/sdk
```

### 3. Set environment variables

Create `.env.local` in your Next.js project root:

```bash
NEXT_PUBLIC_WAITLIST_API_KEY=wl_pk_your-api-key
NEXT_PUBLIC_WAITLIST_BASE_URL=http://localhost:3400

# Server-side only (webhook handler)
WAITLIST_WEBHOOK_SECRET=whsec_my-signing-secret
```

### 4. Copy the files

Copy each file from this directory into the matching path in your Next.js project.

### 5. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

### WaitlistProvider in layout.tsx

`WaitlistProvider` creates one `WaitlistClient` instance for the entire app.
All `WaitlistForm` and `ReferralStatus` components read the client from React
context — no prop drilling required.

### ?ref= referral tracking

The landing page reads `searchParams.ref` and passes it to `WaitlistForm`.
When a user clicks `https://myapp.com/?ref=ABC123`, the referral code is
captured automatically.

### Webhook Route Handler

The `/api/webhook` route handler verifies the HMAC-SHA256 signature before
processing events. See `app/api/webhook/route.ts` for the full implementation.

Register it in the admin panel:

```bash
curl -X POST http://localhost:3400/api/v1/admin/webhooks \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "your-project-uuid",
    "url": "https://your-app.vercel.app/api/webhook",
    "secret": "whsec_my-signing-secret",
    "events": ["subscriber.created", "referral.created", "reward.unlocked"]
  }'
```

## Deployment

Deploy to Vercel with zero configuration:

```bash
vercel deploy
```

Set the environment variables in the Vercel dashboard under
**Settings → Environment Variables**.
