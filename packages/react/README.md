# @waitlist/react

React components and hooks for building waitlist signup flows. Unstyled and fully composable — bring your own CSS or Tailwind classes.

## Installation

```bash
npm install @waitlist/react
```

### Peer Dependencies

```json
{
  "react": ">=18.0.0"
}
```

## Components

### `<WaitlistProvider>`

Wraps your application (or a subtree) with a shared `WaitlistClient` instance so that child components don't need to receive `apiKey` and `baseUrl` individually.

**Props**

| Prop      | Type        | Required | Description                    |
|-----------|-------------|----------|--------------------------------|
| `apiKey`  | `string`    | Yes      | Your project's public API key  |
| `baseUrl` | `string`    | Yes      | Base URL of the API server     |
| `children`| `ReactNode` | Yes      | Child components               |

```tsx
import { WaitlistProvider, WaitlistForm } from "@waitlist/react";

export function App() {
  return (
    <WaitlistProvider apiKey="wl_pk_your_key_here" baseUrl="https://your-api.example.com">
      <WaitlistForm />
    </WaitlistProvider>
  );
}
```

---

### `<WaitlistForm>`

A controlled signup form that calls `subscribe` and shows a success state with the user's position and referral code. Can be used standalone (with `apiKey` + `baseUrl`) or as a child of `<WaitlistProvider>`.

**Props**

| Prop           | Type                               | Required             | Description                                         |
|----------------|------------------------------------|----------------------|-----------------------------------------------------|
| `apiKey`       | `string`                           | Outside provider     | Your project's public API key                       |
| `baseUrl`      | `string`                           | Outside provider     | Base URL of the API server                          |
| `onSuccess`    | `(result: SubscribeResponse) => void` | No                | Called after a successful subscription              |
| `onError`      | `(error: Error) => void`           | No                   | Called when the subscribe request fails             |
| `className`    | `string`                           | No                   | CSS class applied to the wrapper element            |
| `referralCode` | `string`                           | No                   | Pre-fill a referral code (e.g. from a `?ref=` URL param) |

**Usage inside a provider**

```tsx
<WaitlistProvider apiKey="wl_pk_…" baseUrl="https://api.example.com">
  <WaitlistForm
    onSuccess={(res) => console.log("Position:", res.position)}
    onError={(err) => console.error(err.message)}
    className="my-form"
  />
</WaitlistProvider>
```

**Standalone usage**

```tsx
<WaitlistForm
  apiKey="wl_pk_your_key_here"
  baseUrl="https://your-api.example.com"
  referralCode={new URLSearchParams(window.location.search).get("ref") ?? undefined}
  onSuccess={(res) => {
    console.log(`Joined at position #${res.position}`);
    console.log(`Referral code: ${res.referralCode}`);
  }}
/>
```

---

### `<ReferralStatus>`

Fetches and displays a subscriber's current position, referral count, status, and unlocked rewards. Requires an `email` to look up. Can be used standalone or inside a `<WaitlistProvider>`.

**Props**

| Prop        | Type     | Required         | Description                          |
|-------------|----------|------------------|--------------------------------------|
| `email`     | `string` | Yes              | Email address of the subscriber      |
| `apiKey`    | `string` | Outside provider | Your project's public API key        |
| `baseUrl`   | `string` | Outside provider | Base URL of the API server           |
| `className` | `string` | No               | CSS class applied to the wrapper     |

```tsx
<WaitlistProvider apiKey="wl_pk_…" baseUrl="https://api.example.com">
  <ReferralStatus email="user@example.com" className="status-card" />
</WaitlistProvider>
```

Renders position, referral count, status, any unlocked rewards, and the subscriber's referral code.

---

### `useWaitlistClient()`

Returns the `WaitlistClient` instance from the nearest `<WaitlistProvider>`, or `null` if there is none. Use this when you need direct access to the SDK client for custom data fetching.

```tsx
import { useWaitlistClient } from "@waitlist/react";

function LeaderboardWidget() {
  const client = useWaitlistClient();

  useEffect(() => {
    if (!client) return;
    client.getLeaderboard(5).then(console.log);
  }, [client]);

  return <div>...</div>;
}
```

## Styling

All components are **unstyled by default**. They accept a `className` prop that is applied to the outermost element. Style them with Tailwind, CSS modules, or any other approach:

```tsx
<WaitlistForm className="flex flex-col gap-4 max-w-md mx-auto p-6 rounded-xl shadow" />
```

Individual child elements (inputs, buttons) are plain HTML elements with no applied classes, so you can target them with descendant selectors from the `className` wrapper.

## License

Apache 2.0
