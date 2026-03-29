/**
 * examples/sdk/referral-flow.ts
 *
 * Complete referral flow:
 *   1. User A signs up and gets a referral code.
 *   2. User A shares a referral link (e.g. https://myapp.com/?ref=ABC123).
 *   3. User B clicks the link and signs up using that code.
 *   4. We verify both users' statuses and see the referral counted.
 *   5. We check the leaderboard to see User A at the top.
 *
 * Run:
 *   npx tsx examples/sdk/referral-flow.ts
 */

import { WaitlistClient } from "@waitlist/sdk";

const client = new WaitlistClient({
  apiKey: "wl_pk_your-api-key",
  baseUrl: "http://localhost:3400",
});

async function main() {
  // -------------------------------------------------------------------------
  // Step 1: User A signs up (no referral code)
  // -------------------------------------------------------------------------
  console.log("Step 1: User A signs up");
  console.log("─".repeat(40));

  const userA = await client.subscribe({
    email: "alice@example.com",
    name: "Alice",
    channel: "direct",
  });

  console.log(`Alice joined — position #${userA.position}`);
  console.log(`Alice's referral code: ${userA.referralCode}`);
  console.log(`Alice's status: ${userA.status}\n`);

  // -------------------------------------------------------------------------
  // Step 2: User A builds a shareable referral link
  //
  // The convention is ?ref=<referralCode> in the URL query string.
  // The widget picks this up automatically from window.location.
  // For server-side or SDK flows, pass it explicitly.
  // -------------------------------------------------------------------------
  const referralLink = `https://myapp.com/?ref=${userA.referralCode}`;
  console.log("Step 2: Alice shares her referral link");
  console.log("─".repeat(40));
  console.log(`Referral link: ${referralLink}\n`);

  // -------------------------------------------------------------------------
  // Step 3: User B clicks the link and signs up
  //
  // The frontend reads ?ref= from the URL and passes it as referralCode.
  // -------------------------------------------------------------------------
  console.log("Step 3: Bob clicks the link and signs up");
  console.log("─".repeat(40));

  const userB = await client.subscribe({
    email: "bob@example.com",
    name: "Bob",
    referralCode: userA.referralCode,  // extracted from ?ref= query param
    channel: "referral",               // tag the channel for analytics
  });

  console.log(`Bob joined — position #${userB.position}`);
  console.log(`Bob's status: ${userB.status}\n`);

  // -------------------------------------------------------------------------
  // Step 4: Check both users' statuses
  // -------------------------------------------------------------------------
  console.log("Step 4: Check statuses");
  console.log("─".repeat(40));

  const [aliceStatus, bobStatus] = await Promise.all([
    client.getStatus("alice@example.com"),
    client.getStatus("bob@example.com"),
  ]);

  console.log(`Alice — position: ${aliceStatus.position}, referrals: ${aliceStatus.referralCount}`);
  if (aliceStatus.rewards.length > 0) {
    console.log(`Alice unlocked rewards: ${aliceStatus.rewards.join(", ")}`);
  } else {
    console.log("Alice has not unlocked any reward tiers yet.");
  }

  console.log(`Bob   — position: ${bobStatus.position}, referrals: ${bobStatus.referralCount}\n`);

  // -------------------------------------------------------------------------
  // Step 5: Show leaderboard — Alice should appear with 1 referral
  // -------------------------------------------------------------------------
  console.log("Step 5: Leaderboard");
  console.log("─".repeat(40));

  const leaderboard = await client.getLeaderboard(10);

  if (leaderboard.length === 0) {
    console.log("Leaderboard is empty (referrals may not be verified yet).");
  } else {
    leaderboard.forEach((entry) => {
      console.log(
        `  #${entry.rank}  ${(entry.name ?? "Anonymous").padEnd(20)}  ${entry.referralCount} referral(s)`
      );
    });
  }

  // -------------------------------------------------------------------------
  // Step 6: Multiple referrals — Alice shares with Carol and Dave too
  // -------------------------------------------------------------------------
  console.log("\nStep 6: More referrals");
  console.log("─".repeat(40));

  await Promise.all([
    client.subscribe({
      email: "carol@example.com",
      name: "Carol",
      referralCode: userA.referralCode,
      channel: "twitter",
    }),
    client.subscribe({
      email: "dave@example.com",
      name: "Dave",
      referralCode: userA.referralCode,
      channel: "twitter",
    }),
  ]);

  const aliceFinal = await client.getStatus("alice@example.com");
  console.log(`Alice now has ${aliceFinal.referralCount} referral(s)`);
  if (aliceFinal.rewards.length > 0) {
    console.log(`Alice's rewards: ${aliceFinal.rewards.join(", ")}`);
  }

  const finalStats = await client.getStats();
  console.log(`\nTotal signups: ${finalStats.totalSignups}`);
  console.log(`Total referrals: ${finalStats.referralsMade}`);
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
