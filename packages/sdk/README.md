# @waitlist/sdk

Headless JavaScript client for the Waitlist API. Framework-agnostic, works in any browser or Node.js environment.

## Installation

```bash
npm install @waitlist/sdk
```

## Quick Start

```ts
import { WaitlistClient } from "@waitlist/sdk";

const client = new WaitlistClient({
  apiKey: "wl_pk_your_key_here",
  baseUrl: "https://your-api.example.com",
});

const result = await client.subscribe({ email: "user@example.com" });
console.log(`Position #${result.position}, referral code: ${result.referralCode}`);
```

## API Reference

### `new WaitlistClient(options)`

| Option    | Type     | Required | Description                          |
|-----------|----------|----------|--------------------------------------|
| `apiKey`  | `string` | Yes      | Your project's public API key (`wl_pk_…`) |
| `baseUrl` | `string` | Yes      | Base URL of the API server (trailing slash stripped automatically) |

---

### `client.subscribe(input)`

Subscribe a new user to the waitlist.

**Parameters**

| Field          | Type                                                                  | Required | Description                         |
|----------------|-----------------------------------------------------------------------|----------|-------------------------------------|
| `email`        | `string`                                                              | Yes      | Subscriber's email address          |
| `name`         | `string`                                                              | No       | Display name                        |
| `referralCode` | `string`                                                              | No       | Referral code of the person who referred this user |
| `metadata`     | `Record<string, unknown>`                                             | No       | Arbitrary key/value metadata        |
| `channel`      | `"twitter" \| "facebook" \| "linkedin" \| "whatsapp" \| "email" \| "copy" \| "other"` | No | Signup attribution channel |

**Returns** `Promise<SubscribeResponse>`

```ts
const result = await client.subscribe({
  email: "user@example.com",
  name: "Jane Doe",
  referralCode: "abc12345",
  channel: "twitter",
});
// result.id           — subscriber UUID
// result.email        — email address
// result.position     — waitlist position (null if positions are not tracked)
// result.referralCode — this subscriber's unique referral code
// result.status       — "waiting" | "pending" | "approved" | "rejected" | "active" | "banned"
// result.totalSignups — total number of signups on the waitlist
```

---

### `client.getStatus(email)`

Get a subscriber's current waitlist status by email.

**Parameters**

| Parameter | Type     | Required | Description              |
|-----------|----------|----------|--------------------------|
| `email`   | `string` | Yes      | The subscriber's email   |

**Returns** `Promise<SubscriberStatusResponse>`

```ts
const status = await client.getStatus("user@example.com");
// status.position     — current position (null if not tracked)
// status.referralCount — number of successful referrals made
// status.referralCode — their unique referral code
// status.rewards      — array of unlocked reward names
// status.status       — current subscriber status
// status.experiment   — { name, variant } if assigned to an experiment
```

---

### `client.getLeaderboard(limit?)`

Get the top referrers for the waitlist.

**Parameters**

| Parameter | Type     | Required | Default | Description                        |
|-----------|----------|----------|---------|------------------------------------|
| `limit`   | `number` | No       | `10`    | Number of entries to return (max 100) |

**Returns** `Promise<LeaderboardEntry[]>`

```ts
const leaders = await client.getLeaderboard(5);
leaders.forEach((entry) => {
  // entry.rank          — 1-based rank
  // entry.name          — subscriber's name (null if not provided)
  // entry.referralCount — number of verified referrals
  console.log(`#${entry.rank} ${entry.name ?? "Anonymous"} — ${entry.referralCount} referrals`);
});
```

---

### `client.getStats()`

Get public statistics for the waitlist.

**Returns** `Promise<PublicStats>`

```ts
const stats = await client.getStats();
// stats.totalSignups    — total subscribers
// stats.spotsRemaining  — remaining capacity (null if unlimited)
// stats.referralsMade   — total referrals created
```

## Error Handling

All methods throw a plain `Error` with the server's error message when the request fails (non-2xx response).

```ts
try {
  await client.subscribe({ email: "user@example.com" });
} catch (err) {
  if (err instanceof Error) {
    console.error(err.message); // e.g. "Waitlist is full"
  }
}
```

## TypeScript Types

The following types are re-exported from `@waitlist/shared` for convenience:

- `SubscribeRequest`
- `SubscribeResponse`
- `SubscriberStatusResponse`
- `LeaderboardEntry`
- `PublicStats`
- `WaitlistClientOptions`

## License

Apache 2.0
