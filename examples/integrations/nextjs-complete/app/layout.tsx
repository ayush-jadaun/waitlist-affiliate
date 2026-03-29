/**
 * app/layout.tsx — Root layout with WaitlistProvider
 *
 * WaitlistProvider is a "use client" component. Because layout.tsx is
 * a Server Component, we wrap the provider in a thin client boundary
 * (WaitlistProviders.tsx) so the rest of the layout can stay a Server Component.
 *
 * Copy to: your-next-app/app/layout.tsx
 */

import type { Metadata } from "next";
import { WaitlistProviders } from "./WaitlistProviders";

export const metadata: Metadata = {
  title: "MyApp — Coming Soon",
  description: "Join the waitlist and be first in line.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </head>
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        {/*
          WaitlistProviders is a client component that wraps WaitlistProvider.
          It reads the API key and base URL from environment variables so the
          values are never exposed in the server-rendered HTML.
        */}
        <WaitlistProviders>
          {children}
        </WaitlistProviders>
      </body>
    </html>
  );
}
