/**
 * app/WaitlistProviders.tsx — Client boundary for WaitlistProvider
 *
 * This thin wrapper exists so layout.tsx can remain a Server Component while
 * still wrapping children in the WaitlistProvider (a "use client" component).
 *
 * Copy to: your-next-app/app/WaitlistProviders.tsx
 */

"use client";

import { WaitlistProvider } from "@waitlist/react";

const API_KEY  = process.env.NEXT_PUBLIC_WAITLIST_API_KEY  ?? "";
const BASE_URL = process.env.NEXT_PUBLIC_WAITLIST_BASE_URL ?? "http://localhost:3400";

export function WaitlistProviders({ children }: { children: React.ReactNode }) {
  if (!API_KEY) {
    console.warn(
      "[WaitlistProviders] NEXT_PUBLIC_WAITLIST_API_KEY is not set. " +
      "Forms will not work until you add it to .env.local."
    );
  }

  return (
    <WaitlistProvider apiKey={API_KEY} baseUrl={BASE_URL}>
      {children}
    </WaitlistProvider>
  );
}
