#!/usr/bin/env bash
# examples/api/curl-examples.sh
#
# Complete curl examples for every API endpoint in the Waitlist & Viral
# Referral System.
#
# Usage:
#   chmod +x examples/api/curl-examples.sh
#   ./examples/api/curl-examples.sh
#
# Or run individual sections by copying the curl commands into your terminal.
#
# Prerequisites:
#   - API server running: cd apps/api && pnpm dev   (listens on :3400)
#   - curl >= 7.x
#   - jq (optional, for pretty-printing JSON)

set -euo pipefail

BASE="http://localhost:3400"

# Pretty-print helper — falls back gracefully if jq is not installed
pp() { command -v jq &>/dev/null && jq . || cat; }

echo "=================================================="
echo " Waitlist & Referral API — curl examples"
echo "=================================================="


# ===========================================================================
# SECTION 1: Admin setup
# ===========================================================================
echo ""
echo "--- 1. Admin Setup (first-time only) ---"

# POST /api/v1/admin/auth/setup
# Only succeeds when no admin users exist yet.
# Expected: 201 { "token": "eyJ..." }
curl -s -X POST "$BASE/api/v1/admin/auth/setup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "supersecret123"
  }' | pp

# ===========================================================================
# SECTION 2: Admin login
# ===========================================================================
echo ""
echo "--- 2. Admin Login ---"

# POST /api/v1/admin/auth/login
# Expected: 200 { "token": "eyJ..." }
# Save the token to TOKEN for use in subsequent requests.
TOKEN=$(curl -s -X POST "$BASE/api/v1/admin/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "supersecret123"
  }' | jq -r '.token // empty')

echo "JWT: ${TOKEN:0:40}…"


# ===========================================================================
# SECTION 3: Create a waitlist project
# ===========================================================================
echo ""
echo "--- 3a. Create Project — prelaunch mode ---"

# POST /api/v1/admin/project
# mode "prelaunch": everyone joins, positions are public.
# Expected: 201 { "id": "uuid", "apiKey": "wl_pk_...", ... }
PRELAUNCH=$(curl -s -X POST "$BASE/api/v1/admin/project" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "My SaaS Launch",
    "mode": "prelaunch",
    "requireEmailVerification": false,
    "deduplication": "email",
    "rateLimit": { "window": "1m", "max": 10 },
    "referral": {
      "enabled": true,
      "positionBump": 5,
      "maxBumps": 50
    },
    "rewards": []
  }')
echo "$PRELAUNCH" | pp

PRELAUNCH_ID=$(echo "$PRELAUNCH"   | jq -r '.id // empty')
PRELAUNCH_KEY=$(echo "$PRELAUNCH"  | jq -r '.apiKey // empty')
echo "Project ID:  $PRELAUNCH_ID"
echo "API Key:     $PRELAUNCH_KEY"


echo ""
echo "--- 3b. Create Project — gated mode ---"

# mode "gated": subscribers stay "pending" until an admin approves them.
GATED=$(curl -s -X POST "$BASE/api/v1/admin/project" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Gated Beta",
    "mode": "gated",
    "maxSubscribers": 500,
    "requireEmailVerification": true,
    "deduplication": "email+ip",
    "rateLimit": { "window": "1m", "max": 5 },
    "referral": {
      "enabled": true,
      "positionBump": 10
    },
    "rewards": []
  }')
echo "$GATED" | pp

GATED_ID=$(echo "$GATED"   | jq -r '.id // empty')
GATED_KEY=$(echo "$GATED"  | jq -r '.apiKey // empty')


echo ""
echo "--- 3c. Create Project — viral mode ---"

# mode "viral": referral-first, positions not shown publicly.
VIRAL=$(curl -s -X POST "$BASE/api/v1/admin/project" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Viral Product Hunt Launch",
    "mode": "viral",
    "requireEmailVerification": false,
    "deduplication": "email",
    "rateLimit": { "window": "1m", "max": 20 },
    "referral": {
      "enabled": true,
      "positionBump": 3
    },
    "rewards": []
  }')
echo "$VIRAL" | pp

VIRAL_ID=$(echo "$VIRAL"   | jq -r '.id // empty')
VIRAL_KEY=$(echo "$VIRAL"  | jq -r '.apiKey // empty')


echo ""
echo "--- 3d. List all projects ---"

# GET /api/v1/admin/project
curl -s "$BASE/api/v1/admin/project" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "--- 3e. Update project config ---"

# PUT /api/v1/admin/project/:id
# Partial updates are supported — only the fields you send are changed.
curl -s -X PUT "$BASE/api/v1/admin/project/$PRELAUNCH_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "My SaaS Launch (updated)",
    "maxSubscribers": 1000
  }' | pp


# ===========================================================================
# SECTION 4: Subscribe (public endpoint — uses API key, not admin JWT)
# ===========================================================================
echo ""
echo "--- 4a. Subscribe — basic ---"

# POST /api/v1/subscribe
# Expected: 201 { "id": "uuid", "email": "...", "position": 1,
#                 "referralCode": "ABC123", "status": "waiting",
#                 "totalSignups": 1 }
SUB1=$(curl -s -X POST "$BASE/api/v1/subscribe" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $PRELAUNCH_KEY" \
  -d '{
    "email": "alice@example.com",
    "name": "Alice",
    "channel": "homepage"
  }')
echo "$SUB1" | pp

ALICE_CODE=$(echo "$SUB1" | jq -r '.referralCode // empty')
echo "Alice referral code: $ALICE_CODE"


echo ""
echo "--- 4b. Subscribe — with referral code ---"

# Bob signs up using Alice's referral code
SUB2=$(curl -s -X POST "$BASE/api/v1/subscribe" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $PRELAUNCH_KEY" \
  -d "{
    \"email\": \"bob@example.com\",
    \"name\": \"Bob\",
    \"referralCode\": \"$ALICE_CODE\",
    \"channel\": \"referral\"
  }")
echo "$SUB2" | pp


echo ""
echo "--- 4c. Subscribe — with metadata ---"

# Custom metadata is stored as JSON and visible in the admin panel
curl -s -X POST "$BASE/api/v1/subscribe" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $PRELAUNCH_KEY" \
  -d '{
    "email": "carol@example.com",
    "name": "Carol",
    "channel": "product-hunt",
    "metadata": {
      "source": "product-hunt",
      "campaign": "ph-launch-2024",
      "country": "US"
    }
  }' | pp


echo ""
echo "--- 4d. Re-subscribe (idempotent) ---"

# Subscribing with the same email returns 200 (not 201) and the same data
curl -s -X POST "$BASE/api/v1/subscribe" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $PRELAUNCH_KEY" \
  -d '{"email": "alice@example.com"}' | pp


# ===========================================================================
# SECTION 5: Check subscriber status
# ===========================================================================
echo ""
echo "--- 5. Get subscriber status ---"

# GET /api/v1/subscribe/:email/status
# Expected: 200 { "position": 1, "referralCount": 1, "referralCode": "...",
#                 "rewards": [], "status": "waiting" }
curl -s "$BASE/api/v1/subscribe/alice%40example.com/status" \
  -H "X-API-Key: $PRELAUNCH_KEY" | pp


# ===========================================================================
# SECTION 6: Leaderboard
# ===========================================================================
echo ""
echo "--- 6. Leaderboard ---"

# GET /api/v1/leaderboard?limit=10
# Expected: array of { rank, name, referralCount }
curl -s "$BASE/api/v1/leaderboard?limit=10" \
  -H "X-API-Key: $PRELAUNCH_KEY" | pp


# ===========================================================================
# SECTION 7: Public stats
# ===========================================================================
echo ""
echo "--- 7. Public stats ---"

# GET /api/v1/stats
# Expected: { "totalSignups": N, "spotsRemaining": N|null, "referralsMade": N }
curl -s "$BASE/api/v1/stats" \
  -H "X-API-Key: $PRELAUNCH_KEY" | pp


# ===========================================================================
# SECTION 8: Admin — list subscribers
# ===========================================================================
echo ""
echo "--- 8a. List subscribers (paginated) ---"

# GET /api/v1/admin/subscribers?projectId=&page=1&limit=20
# Expected: { data: [...], pagination: { page, limit, total, pages } }
curl -s "$BASE/api/v1/admin/subscribers?projectId=$PRELAUNCH_ID&page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "--- 8b. Filter by status ---"

curl -s "$BASE/api/v1/admin/subscribers?projectId=$PRELAUNCH_ID&status=waiting&page=1&limit=50" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "--- 8c. Search by email ---"

curl -s "$BASE/api/v1/admin/subscribers?projectId=$PRELAUNCH_ID&search=alice&page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN" | pp


# ===========================================================================
# SECTION 9: Admin — approve / reject a single subscriber
# ===========================================================================
echo ""
echo "--- 9. Approve / reject a subscriber ---"

# Get Alice's subscriber ID first
ALICE_ID=$(curl -s "$BASE/api/v1/admin/subscribers?projectId=$GATED_ID&search=alice&page=1&limit=1" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.data[0].id // empty')

if [ -n "$ALICE_ID" ]; then
  # PATCH /api/v1/admin/subscribers/:id
  # status can be: "waiting" | "approved" | "rejected" | "banned"
  echo "Approving subscriber $ALICE_ID"
  curl -s -X PATCH "$BASE/api/v1/admin/subscribers/$ALICE_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status": "approved"}' | pp

  echo "Rejecting subscriber $ALICE_ID"
  curl -s -X PATCH "$BASE/api/v1/admin/subscribers/$ALICE_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"status": "rejected"}' | pp
else
  echo "(No subscriber found to approve/reject — skipping)"
fi


# ===========================================================================
# SECTION 10: Admin — bulk actions
# ===========================================================================
echo ""
echo "--- 10. Bulk actions ---"

# Get a page of subscriber IDs
IDS=$(curl -s "$BASE/api/v1/admin/subscribers?projectId=$PRELAUNCH_ID&page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq '[.data[].id]')

if [ "$(echo "$IDS" | jq 'length')" -gt 0 ]; then
  # POST /api/v1/admin/subscribers/bulk
  # action: "approve" | "reject" | "ban"
  # Expected: { "updated": N }
  echo "Bulk approving ${#IDS} subscribers"
  curl -s -X POST "$BASE/api/v1/admin/subscribers/bulk" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"ids\": $IDS, \"action\": \"approve\"}" | pp
else
  echo "(No subscribers for bulk action — skipping)"
fi


# ===========================================================================
# SECTION 11: Admin — create reward tiers
# ===========================================================================
echo ""
echo "--- 11. Create reward tiers ---"

# POST /api/v1/admin/rewards
# rewardType: "flag" | "code" | "custom"
# Expected: 201 { "id": "uuid", ... }

curl -s -X POST "$BASE/api/v1/admin/rewards" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"projectId\": \"$PRELAUNCH_ID\",
    \"name\": \"Early Bird\",
    \"threshold\": 1,
    \"rewardType\": \"flag\",
    \"rewardValue\": \"early_bird\",
    \"sortOrder\": 0
  }" | pp

curl -s -X POST "$BASE/api/v1/admin/rewards" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"projectId\": \"$PRELAUNCH_ID\",
    \"name\": \"Referral Pro\",
    \"threshold\": 5,
    \"rewardType\": \"code\",
    \"rewardValue\": \"BETA50\",
    \"sortOrder\": 1
  }" | pp

curl -s -X POST "$BASE/api/v1/admin/rewards" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"projectId\": \"$PRELAUNCH_ID\",
    \"name\": \"VIP Access\",
    \"threshold\": 10,
    \"rewardType\": \"custom\",
    \"rewardValue\": \"lifetime_deal\",
    \"sortOrder\": 2
  }" | pp


echo ""
echo "--- 11b. List reward tiers ---"

# GET /api/v1/admin/rewards?projectId=
curl -s "$BASE/api/v1/admin/rewards?projectId=$PRELAUNCH_ID" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "--- 11c. Update a reward tier ---"

REWARD_ID=$(curl -s "$BASE/api/v1/admin/rewards?projectId=$PRELAUNCH_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id // empty')

if [ -n "$REWARD_ID" ]; then
  # PUT /api/v1/admin/rewards/:id
  curl -s -X PUT "$BASE/api/v1/admin/rewards/$REWARD_ID" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"threshold": 2}' | pp
fi


# ===========================================================================
# SECTION 12: Admin — register webhooks
# ===========================================================================
echo ""
echo "--- 12a. Register webhook endpoint ---"

# POST /api/v1/admin/webhooks
# events: array of event type strings to subscribe to
# Expected: 201 { "id": "uuid", ... }
WEBHOOK=$(curl -s -X POST "$BASE/api/v1/admin/webhooks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"projectId\": \"$PRELAUNCH_ID\",
    \"url\": \"https://webhook.site/your-unique-id\",
    \"secret\": \"whsec_my-signing-secret\",
    \"events\": [
      \"subscriber.created\",
      \"subscriber.approved\",
      \"subscriber.rejected\",
      \"referral.created\",
      \"reward.unlocked\"
    ]
  }")
echo "$WEBHOOK" | pp

WEBHOOK_ID=$(echo "$WEBHOOK" | jq -r '.id // empty')


echo ""
echo "--- 12b. List webhooks ---"

curl -s "$BASE/api/v1/admin/webhooks?projectId=$PRELAUNCH_ID" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "--- 12c. List delivery history for a webhook ---"

if [ -n "$WEBHOOK_ID" ]; then
  curl -s "$BASE/api/v1/admin/webhooks/$WEBHOOK_ID/deliveries?page=1&limit=20" \
    -H "Authorization: Bearer $TOKEN" | pp
fi


echo ""
echo "--- 12d. Delete a webhook ---"

# DELETE /api/v1/admin/webhooks/:id
# Expected: 204 No Content
if [ -n "$WEBHOOK_ID" ]; then
  curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    -X DELETE "$BASE/api/v1/admin/webhooks/$WEBHOOK_ID" \
    -H "Authorization: Bearer $TOKEN"
fi


# ===========================================================================
# SECTION 13: Admin — A/B experiments
# ===========================================================================
echo ""
echo "--- 13a. Create experiment ---"

# POST /api/v1/admin/experiments
# variants: array of variant name strings; subscribers are assigned on signup
# Expected: 201 { "id": "uuid", "active": true, ... }
EXP=$(curl -s -X POST "$BASE/api/v1/admin/experiments" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"projectId\": \"$PRELAUNCH_ID\",
    \"name\": \"button-copy-test\",
    \"variants\": [\"control\", \"join-now\", \"get-early-access\"]
  }")
echo "$EXP" | pp

EXP_ID=$(echo "$EXP" | jq -r '.id // empty')


echo ""
echo "--- 13b. List experiments ---"

curl -s "$BASE/api/v1/admin/experiments?projectId=$PRELAUNCH_ID" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "--- 13c. Toggle experiment active status ---"

# PATCH /api/v1/admin/experiments/:id  (toggles active flag)
if [ -n "$EXP_ID" ]; then
  curl -s -X PATCH "$BASE/api/v1/admin/experiments/$EXP_ID" \
    -H "Authorization: Bearer $TOKEN" | pp
fi


echo ""
echo "--- 13d. Delete experiment ---"

# DELETE /api/v1/admin/experiments/:id
# Expected: 204 No Content
if [ -n "$EXP_ID" ]; then
  curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    -X DELETE "$BASE/api/v1/admin/experiments/$EXP_ID" \
    -H "Authorization: Bearer $TOKEN"
fi


# ===========================================================================
# SECTION 14: Admin — analytics
# ===========================================================================
echo ""
echo "--- 14a. Analytics overview ---"

# GET /api/v1/admin/analytics/overview?projectId=
# Expected: { totalSignups, todaySignups, totalReferrals, todayReferrals,
#             conversionRate, kFactor }
curl -s "$BASE/api/v1/admin/analytics/overview?projectId=$PRELAUNCH_ID" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "--- 14b. Analytics timeseries ---"

# GET /api/v1/admin/analytics/timeseries?projectId=&from=&to=
# from/to are ISO date strings (YYYY-MM-DD)
FROM=$(date -d "30 days ago" +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)
TO=$(date +%Y-%m-%d)

curl -s "$BASE/api/v1/admin/analytics/timeseries?projectId=$PRELAUNCH_ID&from=$FROM&to=$TO" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "--- 14c. Cohort analysis ---"

# GET /api/v1/admin/analytics/cohorts?projectId=
# Expected: array of cohort rows with referred1d, referred7d, referred30d, depth metrics
curl -s "$BASE/api/v1/admin/analytics/cohorts?projectId=$PRELAUNCH_ID" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "--- 14d. Channel analytics ---"

# GET /api/v1/admin/analytics/channels?projectId=
# Expected: array of { channel, count } — shows which referral channels drive signups
curl -s "$BASE/api/v1/admin/analytics/channels?projectId=$PRELAUNCH_ID" \
  -H "Authorization: Bearer $TOKEN" | pp


echo ""
echo "=================================================="
echo " Done! All examples executed."
echo "=================================================="
