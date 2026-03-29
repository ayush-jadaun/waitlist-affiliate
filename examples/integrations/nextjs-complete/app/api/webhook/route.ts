/**
 * app/api/webhook/route.ts — Next.js Route Handler for webhooks
 *
 * Receives webhook events from the Waitlist API, verifies the HMAC-SHA256
 * signature, and routes to the appropriate handler.
 *
 * Deploy to Vercel and register the URL:
 *   https://your-app.vercel.app/api/webhook
 *
 * Copy to: your-next-app/app/api/webhook/route.ts
 *
 * Environment variable (server-side only — no NEXT_PUBLIC_ prefix):
 *   WAITLIST_WEBHOOK_SECRET=whsec_my-signing-secret
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { WebhookEvent } from "@waitlist/shared";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const WEBHOOK_SECRET = process.env.WAITLIST_WEBHOOK_SECRET ?? "";

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------
function verifySignature(rawBody: Buffer, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[webhook] WAITLIST_WEBHOOK_SECRET is not set — skipping verification");
    return true; // Allow in dev when no secret is configured
  }

  const expected = createHmac("sha256", WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------
async function onSubscriberCreated(event: WebhookEvent): Promise<void> {
  const data = event.data as {
    email: string;
    name?: string;
    position: number | null;
    referralCode: string;
  };

  console.log(
    `[subscriber.created] ${data.name ?? data.email} — position #${data.position}`
  );

  // TODO: Send welcome email, add to CRM, etc.
  // Examples:
  //   await resend.emails.send({ from: "...", to: data.email, subject: "You're in!", ... });
  //   await hubspot.contacts.create({ email: data.email, properties: { ... } });
}

async function onSubscriberApproved(event: WebhookEvent): Promise<void> {
  const { email } = event.data as { email: string };
  console.log(`[subscriber.approved] ${email}`);

  // TODO: Send approval email with access link
}

async function onReferralCreated(event: WebhookEvent): Promise<void> {
  const data = event.data as {
    referrerEmail: string;
    referredEmail: string;
    referrerPosition: number | null;
  };
  console.log(
    `[referral.created] ${data.referrerEmail} referred ${data.referredEmail}` +
    (data.referrerPosition !== null ? ` → now #${data.referrerPosition}` : "")
  );

  // TODO: Notify referrer that they moved up the list
}

async function onRewardUnlocked(event: WebhookEvent): Promise<void> {
  const data = event.data as {
    email: string;
    rewardName: string;
    rewardType: "flag" | "code" | "custom";
    rewardValue: string;
  };
  console.log(`[reward.unlocked] ${data.email} unlocked "${data.rewardName}"`);

  if (data.rewardType === "code") {
    // TODO: Email the coupon code
    console.log(`  Coupon code: ${data.rewardValue}`);
  }
}

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------
const HANDLERS: Record<string, (event: WebhookEvent) => Promise<void>> = {
  "subscriber.created":  onSubscriberCreated,
  "subscriber.approved": onSubscriberApproved,
  "referral.created":    onReferralCreated,
  "reward.unlocked":     onRewardUnlocked,
};

// ---------------------------------------------------------------------------
// In-memory idempotency guard (for demo; use KV / DB in production)
// ---------------------------------------------------------------------------
const processedIds = new Set<string>();

// ---------------------------------------------------------------------------
// POST /api/webhook
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Read raw body (needed for signature verification BEFORE parsing JSON)
  const rawBody = Buffer.from(await request.arrayBuffer());

  // 2. Verify signature
  const signature = request.headers.get("x-waitlist-signature") ?? "";
  if (!verifySignature(rawBody, signature)) {
    console.warn("[webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. Parse event
  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 4. Idempotency check
  if (processedIds.has(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }
  processedIds.add(event.id);

  // 5. Acknowledge before processing (prevents timeout retries)
  const response = NextResponse.json({ received: true });

  // 6. Route to handler
  const handler = HANDLERS[event.type];
  if (handler) {
    // Fire-and-forget so the response is sent immediately.
    // Use a background job queue (Inngest, Trigger.dev, etc.) in production.
    void handler(event).catch((err: unknown) =>
      console.error(`[webhook] Error handling ${event.type}:`, err)
    );
  } else {
    console.log(`[webhook] Unhandled event type: ${event.type}`);
  }

  return response;
}

// ---------------------------------------------------------------------------
// GET /api/webhook — health check
// ---------------------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ status: "ok" });
}
