/**
 * examples/react/next-js-integration.tsx
 *
 * Next.js App Router integration with WaitlistProvider in layout and
 * WaitlistForm in a page.
 *
 * This single file contains all three pieces as named exports so you can
 * copy-paste the relevant sections into your Next.js project:
 *
 *   RootLayout    → app/layout.tsx
 *   WaitlistPage  → app/waitlist/page.tsx (or app/page.tsx)
 *   StatusPage    → app/status/page.tsx
 *
 * See examples/integrations/nextjs-complete/ for the full project structure.
 */

"use client";   // This file uses client-side React hooks

import React, { useState, Suspense } from "react";
import { WaitlistProvider, WaitlistForm, ReferralStatus } from "@waitlist/react";
import type { SubscribeResponse } from "@waitlist/sdk";

// ---------------------------------------------------------------------------
// Environment variables
// In Next.js, client-accessible env vars must be prefixed with NEXT_PUBLIC_
// ---------------------------------------------------------------------------
const API_KEY  = process.env.NEXT_PUBLIC_WAITLIST_API_KEY  ?? "wl_pk_your-api-key";
const BASE_URL = process.env.NEXT_PUBLIC_WAITLIST_BASE_URL ?? "http://localhost:3400";

// ===========================================================================
// 1. Root Layout  (app/layout.tsx)
//
// Wrapping the whole app in WaitlistProvider means every page can use
// WaitlistForm and ReferralStatus without passing apiKey/baseUrl as props.
// ===========================================================================
export function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/*
          WaitlistProvider is a client component, but layout.tsx itself can
          stay a Server Component as long as this provider is extracted into a
          separate "use client" file.  See:
            apps/web/providers/WaitlistProviders.tsx  (client component)
            app/layout.tsx                            (server component that imports it)

          For this example we inline everything for clarity.
        */}
        <WaitlistProvider apiKey={API_KEY} baseUrl={BASE_URL}>
          {children}
        </WaitlistProvider>
      </body>
    </html>
  );
}

// ===========================================================================
// 2. Landing / Waitlist Page  (app/page.tsx or app/waitlist/page.tsx)
//
// "use client" is needed because WaitlistForm uses useState internally.
// If you want a Server Component page, move the form into a separate
// "use client" child component.
// ===========================================================================
export function WaitlistPage({
  searchParams,
}: {
  searchParams?: { ref?: string };
}) {
  const [result, setResult] = useState<SubscribeResponse | null>(null);

  // Next.js passes query params as searchParams in page components
  const referralCode = searchParams?.ref;

  return (
    <main style={pageStyles.main}>
      <section style={pageStyles.hero}>
        <h1 style={pageStyles.heroTitle}>We're launching soon.</h1>
        <p style={pageStyles.heroSub}>
          Join the waitlist and be first in line.
          {referralCode && " You were referred by a friend!"}
        </p>
      </section>

      {result ? (
        <SuccessCard result={result} />
      ) : (
        <div style={pageStyles.formCard}>
          {/*
            WaitlistForm reads the WaitlistClient from the nearest
            WaitlistProvider in the component tree (from RootLayout above).
            No apiKey/baseUrl needed here.
          */}
          <WaitlistForm
            referralCode={referralCode}
            onSuccess={(res) => setResult(res)}
            onError={(err) => console.error("Waitlist error:", err.message)}
          />
        </div>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Success card — shown after joining
// ---------------------------------------------------------------------------
function SuccessCard({ result }: { result: SubscribeResponse }) {
  const [copied, setCopied] = useState(false);
  const referralUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/waitlist?ref=${result.referralCode}`;

  return (
    <div style={pageStyles.formCard}>
      <h2 style={pageStyles.successH2}>You're on the list!</h2>
      {result.position !== null && (
        <p>Your position: <strong>#{result.position}</strong></p>
      )}
      <p style={pageStyles.muted}>
        Share your link to move up:
      </p>
      <div style={pageStyles.linkRow}>
        <code style={pageStyles.linkCode}>{referralUrl}</code>
        <button
          style={pageStyles.copyBtn}
          onClick={() => {
            navigator.clipboard.writeText(referralUrl).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p style={pageStyles.muted}>
        Check your status any time at{" "}
        <a href={`/status?email=${encodeURIComponent(result.email)}`} style={pageStyles.link}>
          your status page →
        </a>
      </p>
    </div>
  );
}

// ===========================================================================
// 3. Status Page  (app/status/page.tsx)
//
// Shows the user's current position, referral count, and rewards.
// Linked from the success card above.
// ===========================================================================
export function StatusPage({
  searchParams,
}: {
  searchParams?: { email?: string };
}) {
  const email = searchParams?.email ?? "";

  if (!email) {
    return (
      <main style={pageStyles.main}>
        <div style={pageStyles.formCard}>
          <p>No email provided. Go back to <a href="/">the waitlist</a>.</p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyles.main}>
      <div style={pageStyles.formCard}>
        <h1 style={pageStyles.heroTitle}>Your Waitlist Status</h1>
        <p style={pageStyles.muted}>{email}</p>

        {/*
          ReferralStatus fetches and renders the subscriber's status.
          It uses the WaitlistClient from WaitlistProvider (set in RootLayout).
          Falls back to polling via useEffect — no websockets needed.
        */}
        <Suspense fallback={<p>Loading status…</p>}>
          <ReferralStatus
            email={email}
            className="referral-status"
          />
        </Suspense>

        <p style={{ ...pageStyles.muted, marginTop: "1.5rem" }}>
          <a href="/" style={pageStyles.link}>← Back to homepage</a>
        </p>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const pageStyles: Record<string, React.CSSProperties> = {
  main: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: 480,
    margin: "0 auto",
    padding: "4rem 1.5rem",
  },
  hero: { textAlign: "center", marginBottom: "2.5rem" },
  heroTitle: { fontSize: "2rem", fontWeight: 800, color: "#0f172a", margin: 0 },
  heroSub: { color: "#475569", marginTop: "0.75rem", lineHeight: 1.6 },
  formCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    padding: "2rem",
  },
  successH2: { fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" },
  muted: { color: "#64748b", fontSize: "0.875rem", marginTop: "0.5rem" },
  linkRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    margin: "0.75rem 0",
  },
  linkCode: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: "0.75rem",
    color: "#475569",
    wordBreak: "break-all",
  },
  copyBtn: {
    padding: "0.25rem 0.75rem",
    background: "#4a9eff",
    color: "#fff",
    border: "none",
    borderRadius: "0.25rem",
    cursor: "pointer",
    fontSize: "0.75rem",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  link: { color: "#4a9eff", textDecoration: "none" },
};

// ===========================================================================
// USAGE NOTES:
//
// .env.local (for local development):
//   NEXT_PUBLIC_WAITLIST_API_KEY=wl_pk_your-api-key
//   NEXT_PUBLIC_WAITLIST_BASE_URL=http://localhost:3400
//
// package.json dependencies to add:
//   "@waitlist/react": "*",
//   "@waitlist/sdk": "*"
//
// If you use Server Components for most pages, create a client wrapper:
//
//   // app/_components/WaitlistProviders.tsx
//   "use client";
//   export { WaitlistProvider } from "@waitlist/react";
//
//   // app/layout.tsx  (Server Component)
//   import { WaitlistProviders } from "./_components/WaitlistProviders";
//   export default function RootLayout({ children }) {
//     return (
//       <html><body>
//         <WaitlistProviders apiKey={...} baseUrl={...}>
//           {children}
//         </WaitlistProviders>
//       </body></html>
//     );
//   }
// ===========================================================================
