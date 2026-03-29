/**
 * examples/api/webhook-receiver.ts
 *
 * Express webhook receiver for the Waitlist & Viral Referral System.
 *
 * Features:
 *   - Signature verification using HMAC-SHA256
 *   - Event type routing
 *   - Idempotency guard (using an in-memory seen-IDs set for demo)
 *   - Proper error handling and response codes
 *
 * Run:
 *   npx tsx examples/api/webhook-receiver.ts
 *
 * Then register the webhook in the admin panel:
 *   POST /api/v1/admin/webhooks
 *   { "url": "http://localhost:4000/webhooks", "secret": "whsec_my-secret", "events": [...] }
 */

import express, { type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { WebhookEvent } from "@waitlist/shared";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT   = 4000;
const SECRET = process.env.WEBHOOK_SECRET ?? "whsec_my-signing-secret";

// ---------------------------------------------------------------------------
// Signature verification
//
// The API signs each webhook delivery with:
//   HMAC-SHA256(secret, rawBody)
//
// The signature is sent in the "X-Waitlist-Signature" header as a hex string.
// We must compare using a timing-safe equality check to prevent timing attacks.
// ---------------------------------------------------------------------------
function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    // Buffer lengths differ → invalid signature
    return false;
  }
}

// ---------------------------------------------------------------------------
// In-memory idempotency store
// In production, use Redis or your database:
//   await redis.set(`wh:${event.id}`, "1", "EX", 86400)
// ---------------------------------------------------------------------------
const processedEventIds = new Set<string>();

// ---------------------------------------------------------------------------
// Event handlers — one function per event type
// ---------------------------------------------------------------------------
async function handleSubscriberCreated(event: WebhookEvent): Promise<void> {
  const { email, name, position, referralCode } = event.data as {
    email: string;
    name?: string;
    position: number | null;
    referralCode: string;
  };

  console.log(`[subscriber.created] ${name ?? email} joined at position #${position}`);
  console.log(`  referral code: ${referralCode}`);

  // Example: Send a welcome email via your email provider
  // await sendWelcomeEmail({ email, name, position, referralCode });
}

async function handleSubscriberApproved(event: WebhookEvent): Promise<void> {
  const { email } = event.data as { email: string };

  console.log(`[subscriber.approved] ${email} has been approved`);

  // Example: Send an "you're in!" email with access instructions
  // await sendApprovalEmail({ email });
}

async function handleSubscriberRejected(event: WebhookEvent): Promise<void> {
  const { email } = event.data as { email: string };

  console.log(`[subscriber.rejected] ${email} has been rejected`);

  // Example: Log to your CRM
  // await crm.updateContact(email, { status: "rejected" });
}

async function handleReferralCreated(event: WebhookEvent): Promise<void> {
  const { referrerEmail, referredEmail, referrerPosition } = event.data as {
    referrerEmail: string;
    referredEmail: string;
    referrerPosition: number | null;
  };

  console.log(
    `[referral.created] ${referrerEmail} referred ${referredEmail}` +
    (referrerPosition !== null ? ` → now at #${referrerPosition}` : "")
  );

  // Example: Send a "you moved up!" notification to the referrer
  // await sendPositionUpdateEmail({ email: referrerEmail, position: referrerPosition });
}

async function handleRewardUnlocked(event: WebhookEvent): Promise<void> {
  const { email, rewardName, rewardType, rewardValue } = event.data as {
    email: string;
    rewardName: string;
    rewardType: "flag" | "code" | "custom";
    rewardValue: string;
  };

  console.log(`[reward.unlocked] ${email} unlocked "${rewardName}" (${rewardType}: ${rewardValue})`);

  if (rewardType === "code") {
    // Example: Send the discount code by email
    // await sendRewardEmail({ email, couponCode: rewardValue });
    console.log(`  → Should email coupon code: ${rewardValue}`);
  }
}

// ---------------------------------------------------------------------------
// Event router
// ---------------------------------------------------------------------------
const EVENT_HANDLERS: Record<string, (event: WebhookEvent) => Promise<void>> = {
  "subscriber.created":  handleSubscriberCreated,
  "subscriber.approved": handleSubscriberApproved,
  "subscriber.rejected": handleSubscriberRejected,
  "referral.created":    handleReferralCreated,
  "reward.unlocked":     handleRewardUnlocked,
};

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();

// IMPORTANT: Use express.raw() to get the raw body for signature verification.
// express.json() parses the body and discards the raw bytes, which breaks HMAC.
app.use(
  "/webhooks",
  express.raw({ type: "application/json" })
);

app.post("/webhooks", async (req: Request, res: Response) => {
  // 1. Extract signature from header
  const signature = req.headers["x-waitlist-signature"] as string | undefined;
  if (!signature) {
    console.warn("Webhook received without signature — rejected");
    return res.status(401).json({ error: "Missing X-Waitlist-Signature header" });
  }

  // 2. Verify HMAC-SHA256 signature
  const rawBody = req.body as Buffer;
  if (!verifySignature(rawBody, signature, SECRET)) {
    console.warn("Webhook signature mismatch — rejected");
    return res.status(401).json({ error: "Invalid signature" });
  }

  // 3. Parse body
  let event: WebhookEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as WebhookEvent;
  } catch {
    return res.status(400).json({ error: "Invalid JSON body" });
  }

  // 4. Idempotency check — avoid processing the same event twice
  if (processedEventIds.has(event.id)) {
    console.log(`Duplicate event ${event.id} — skipping`);
    return res.status(200).json({ received: true, duplicate: true });
  }
  processedEventIds.add(event.id);

  // 5. Respond quickly (2xx) before doing any async work.
  //    The waitlist API will retry if it doesn't receive a 2xx within ~5 s.
  res.status(200).json({ received: true });

  // 6. Route to handler
  const handler = EVENT_HANDLERS[event.type];
  if (!handler) {
    console.log(`Unhandled event type: ${event.type}`);
    return;
  }

  try {
    await handler(event);
  } catch (err) {
    // Log but don't re-send a response (already sent above)
    console.error(`Error handling event ${event.type}:`, err);
  }
});

// Health check — useful for load balancers and Railway/Fly.io health probes
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Webhook receiver listening on http://localhost:${PORT}/webhooks`);
  console.log(`Signature secret: ${SECRET.slice(0, 12)}…`);
});

export { app, verifySignature };
