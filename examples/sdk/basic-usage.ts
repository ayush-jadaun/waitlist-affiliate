/**
 * examples/sdk/basic-usage.ts
 *
 * Basic SDK usage — subscribe, check status, get leaderboard, get stats.
 *
 * Run:
 *   npx tsx examples/sdk/basic-usage.ts
 *
 * Requires the API server to be running:
 *   cd apps/api && pnpm dev
 */

import { WaitlistClient } from "@waitlist/sdk";

const client = new WaitlistClient({
  apiKey: "wl_pk_your-api-key",
  baseUrl: "http://localhost:3400",
});

async function main() {
  // -------------------------------------------------------------------------
  // 1. Subscribe a new user
  // -------------------------------------------------------------------------
  console.log("--- Subscribe ---");

  const result = await client.subscribe({
    email: "jane@example.com",
    name: "Jane Smith",
    // Optionally tag the acquisition channel for analytics
    channel: "homepage",
  });

  console.log(`Joined at position #${result.position}`);
  console.log(`Subscriber id:   ${result.id}`);
  console.log(`Status:          ${result.status}`);      // "waiting" | "approved" | ...
  console.log(`Referral code:   ${result.referralCode}`);
  console.log(`Total signups:   ${result.totalSignups}`);

  // Re-subscribing the same email returns a 200 (not 201) and the same data —
  // useful for idempotent sign-up flows.
  const again = await client.subscribe({ email: "jane@example.com" });
  console.log(`Re-subscribe (idempotent): position #${again.position}`);

  // -------------------------------------------------------------------------
  // 2. Check status later (e.g. on the status page after email verification)
  // -------------------------------------------------------------------------
  console.log("\n--- Status ---");

  const status = await client.getStatus("jane@example.com");
  console.log(`Position:      ${status.position ?? "N/A (gated mode)"}`);
  console.log(`Referral code: ${status.referralCode}`);
  console.log(`Referrals:     ${status.referralCount}`);
  console.log(`Status:        ${status.status}`);
  console.log(`Rewards:       ${status.rewards.length ? status.rewards.join(", ") : "none yet"}`);

  if (status.experiment) {
    // If the user is enrolled in an A/B experiment they will carry a variant tag
    console.log(`Experiment:    ${status.experiment.name} → ${status.experiment.variant}`);
  }

  // -------------------------------------------------------------------------
  // 3. Public leaderboard — top referrers (names are anonymised by the API)
  // -------------------------------------------------------------------------
  console.log("\n--- Leaderboard (top 5) ---");

  const leaders = await client.getLeaderboard(5);

  if (leaders.length === 0) {
    console.log("No referrals yet — leaderboard is empty.");
  } else {
    leaders.forEach((entry) => {
      const name = entry.name ?? "Anonymous";
      console.log(`  #${entry.rank}  ${name.padEnd(20)} ${entry.referralCount} referral(s)`);
    });
  }

  // -------------------------------------------------------------------------
  // 4. Public stats — show a live counter on the landing page
  // -------------------------------------------------------------------------
  console.log("\n--- Stats ---");

  const stats = await client.getStats();
  console.log(`Total signups:    ${stats.totalSignups}`);
  console.log(`Referrals made:   ${stats.referralsMade}`);
  console.log(
    `Spots remaining:  ${stats.spotsRemaining !== null ? stats.spotsRemaining : "unlimited"}`
  );
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
