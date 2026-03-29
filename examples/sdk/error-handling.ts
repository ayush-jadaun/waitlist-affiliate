/**
 * examples/sdk/error-handling.ts
 *
 * Error handling patterns for the WaitlistClient:
 *   - Basic try/catch
 *   - Distinguishing error types by message
 *   - Retry logic with exponential back-off
 *   - Handling 404 (subscriber not found)
 *   - Handling 409 (waitlist full / duplicate)
 *   - Handling 400 (validation errors)
 *
 * Run:
 *   npx tsx examples/sdk/error-handling.ts
 */

import { WaitlistClient } from "@waitlist/sdk";

const client = new WaitlistClient({
  apiKey: "wl_pk_your-api-key",
  baseUrl: "http://localhost:3400",
});

// ---------------------------------------------------------------------------
// Pattern 1: Basic try/catch
// The SDK throws a plain Error whose message comes from the API's `error` field.
// ---------------------------------------------------------------------------
async function basicErrorHandling() {
  console.log("Pattern 1: Basic try/catch");
  console.log("─".repeat(40));

  try {
    // Intentionally bad email to trigger a 400 validation error
    await client.subscribe({ email: "not-an-email" });
  } catch (err) {
    if (err instanceof Error) {
      console.log(`Caught: ${err.message}`);
      // Output: "Validation failed" (or similar from the API)
    }
  }
}

// ---------------------------------------------------------------------------
// Pattern 2: Check status for a subscriber that does not exist (404)
// ---------------------------------------------------------------------------
async function handleNotFound() {
  console.log("\nPattern 2: Handle 404 — subscriber not found");
  console.log("─".repeat(40));

  try {
    await client.getStatus("nobody@example.com");
    console.log("Status found.");
  } catch (err) {
    if (err instanceof Error && err.message.includes("not found")) {
      console.log("Subscriber not on waitlist — show sign-up form.");
    } else {
      throw err; // unexpected error — re-throw
    }
  }
}

// ---------------------------------------------------------------------------
// Pattern 3: Detect "Waitlist is full" (409)
// ---------------------------------------------------------------------------
async function handleWaitlistFull() {
  console.log("\nPattern 3: Handle 409 — waitlist full");
  console.log("─".repeat(40));

  try {
    await client.subscribe({ email: "latecomer@example.com" });
    console.log("Joined successfully.");
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Waitlist is full") {
        console.log("Waitlist is at capacity — show a 'notify me' fallback.");
      } else if (err.message.startsWith("HTTP 4")) {
        console.log(`Client error: ${err.message}`);
      } else {
        console.log(`Server/network error: ${err.message}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Pattern 4: Retry with exponential back-off
// Useful for transient network errors or 5xx responses.
// ---------------------------------------------------------------------------
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 300
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof Error) {
        // Only retry on server errors (5xx) or network failures.
        // Do NOT retry on client errors (4xx) — they won't self-heal.
        const isRetryable =
          err.message.startsWith("HTTP 5") ||
          err.message.includes("fetch failed") ||
          err.message.includes("ECONNREFUSED");

        if (!isRetryable || attempt === maxAttempts) {
          throw err;
        }

        lastError = err;
        const delay = baseDelayMs * 2 ** (attempt - 1); // 300 → 600 → 1200 ms
        console.log(`  Attempt ${attempt} failed: ${err.message}. Retrying in ${delay}ms…`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }

  throw lastError;
}

async function retryExample() {
  console.log("\nPattern 4: Retry with exponential back-off");
  console.log("─".repeat(40));

  try {
    const stats = await withRetry(() => client.getStats(), 3, 300);
    console.log(`Stats fetched after retry: ${stats.totalSignups} signups`);
  } catch (err) {
    console.log(`Failed after all retries: ${(err as Error).message}`);
  }
}

// ---------------------------------------------------------------------------
// Pattern 5: Graceful degradation — show cached/fallback UI if API is down
// ---------------------------------------------------------------------------
async function gracefulDegradation() {
  console.log("\nPattern 5: Graceful degradation");
  console.log("─".repeat(40));

  const FALLBACK_STATS = { totalSignups: 0, spotsRemaining: null, referralsMade: 0 };

  const stats = await client.getStats().catch((err) => {
    console.warn(`Stats unavailable (${err.message}), using fallback data.`);
    return FALLBACK_STATS;
  });

  console.log(`Showing stats (live or fallback): ${stats.totalSignups} signups`);
}

// ---------------------------------------------------------------------------
// Pattern 6: Safe subscribe — returns null instead of throwing on expected errors
// ---------------------------------------------------------------------------
type SubscribeOutcome =
  | { ok: true; data: Awaited<ReturnType<typeof client.subscribe>> }
  | { ok: false; reason: "full" | "invalid" | "unknown"; message: string };

async function safeSubscribe(email: string, name?: string): Promise<SubscribeOutcome> {
  try {
    const data = await client.subscribe({ email, name });
    return { ok: true, data };
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "Waitlist is full") {
        return { ok: false, reason: "full", message: err.message };
      }
      if (err.message === "Validation failed" || err.message.startsWith("HTTP 4")) {
        return { ok: false, reason: "invalid", message: err.message };
      }
      return { ok: false, reason: "unknown", message: err.message };
    }
    return { ok: false, reason: "unknown", message: "Unknown error" };
  }
}

async function safeSubscribeExample() {
  console.log("\nPattern 6: safeSubscribe wrapper");
  console.log("─".repeat(40));

  const outcomes = await Promise.all([
    safeSubscribe("good@example.com", "Good User"),
    safeSubscribe("not-an-email"),
  ]);

  for (const outcome of outcomes) {
    if (outcome.ok) {
      console.log(`Subscribed at position #${outcome.data.position} (code: ${outcome.data.referralCode})`);
    } else {
      console.log(`Subscribe failed [${outcome.reason}]: ${outcome.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Run all patterns sequentially
// ---------------------------------------------------------------------------
async function main() {
  await basicErrorHandling();
  await handleNotFound();
  await handleWaitlistFull();
  await retryExample();
  await gracefulDegradation();
  await safeSubscribeExample();
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
