/**
 * examples/react/basic-form.tsx
 *
 * WaitlistForm with WaitlistProvider, handling success and error callbacks.
 *
 * The provider creates a single WaitlistClient instance and shares it via
 * React context, so all child components (WaitlistForm, ReferralStatus) share
 * the same client without re-instantiating it.
 */

import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { WaitlistProvider, WaitlistForm } from "@waitlist/react";
import type { SubscribeResponse } from "@waitlist/sdk";

// ---------------------------------------------------------------------------
// Top-level app — wrap everything in WaitlistProvider
// ---------------------------------------------------------------------------
function App() {
  return (
    // WaitlistProvider must wrap any component that uses WaitlistForm or
    // ReferralStatus without their own apiKey/baseUrl props.
    <WaitlistProvider
      apiKey="wl_pk_your-api-key"
      baseUrl="http://localhost:3400"
    >
      <main style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.h1}>Coming Soon</h1>
          <p style={styles.tagline}>
            We're building something great. Be the first to know.
          </p>
        </header>

        <WaitlistSection />
      </main>
    </WaitlistProvider>
  );
}

// ---------------------------------------------------------------------------
// WaitlistSection — handles success/error state around the form
// ---------------------------------------------------------------------------
function WaitlistSection() {
  // We lift the result out of WaitlistForm via the onSuccess callback so we
  // can render additional UI (share prompt, etc.) after joining.
  const [joined, setJoined] = useState<SubscribeResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Read ?ref= from the URL so referrals are tracked automatically
  const referralCode =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("ref") ?? undefined
      : undefined;

  if (joined) {
    return <SuccessBanner result={joined} />;
  }

  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>Join the Waitlist</h2>

      {/* onError fires when the API returns an error or the network fails */}
      {errorMsg && (
        <div role="alert" style={styles.errorBanner}>
          {errorMsg}
        </div>
      )}

      {/*
        WaitlistForm reads the WaitlistClient from context (no apiKey/baseUrl
        needed here because WaitlistProvider is an ancestor).

        Props:
          onSuccess(result)   — called after a successful 201/200 response
          onError(error)      — called when subscribe() throws
          className           — CSS class added to the <form> / success <div>
          referralCode        — ?ref= value from the URL
      */}
      <WaitlistForm
        className="waitlist-form"
        referralCode={referralCode}
        onSuccess={(result) => {
          setErrorMsg(null);
          setJoined(result);
        }}
        onError={(err) => {
          setErrorMsg(err.message);
        }}
      />

      <p style={styles.hint}>
        No spam. Unsubscribe anytime.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// SuccessBanner — shown after joining
// ---------------------------------------------------------------------------
function SuccessBanner({ result }: { result: SubscribeResponse }) {
  const [copied, setCopied] = useState(false);

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?ref=${result.referralCode}`
      : `https://myapp.com/?ref=${result.referralCode}`;

  function copyLink() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section style={styles.section}>
      <div style={styles.successIcon} aria-hidden>✓</div>
      <h2 style={styles.h2}>You're on the list!</h2>

      {result.position !== null && (
        <p style={styles.position}>
          You are <strong>#{result.position}</strong> on the waitlist.
        </p>
      )}

      <p style={styles.body}>
        Share your referral link to move up the list:
      </p>

      <div style={styles.referralRow}>
        <code style={styles.code}>{referralUrl}</code>
        <button style={styles.copyBtn} onClick={copyLink}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <p style={styles.hint}>
        Your referral code: <code>{result.referralCode}</code>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Minimal inline styles (replace with Tailwind / CSS Modules in real projects)
// ---------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "3rem 1.5rem",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  header: { textAlign: "center", marginBottom: "2.5rem" },
  h1: { fontSize: "2rem", fontWeight: 800, color: "#0f172a", margin: 0 },
  tagline: { color: "#475569", marginTop: "0.75rem", lineHeight: 1.6 },
  section: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    padding: "2rem",
    textAlign: "center",
  },
  h2: { fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" },
  errorBanner: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: "0.375rem",
    padding: "0.75rem 1rem",
    marginBottom: "1rem",
    fontSize: "0.875rem",
  },
  hint: { color: "#94a3b8", fontSize: "0.75rem", marginTop: "0.75rem" },
  successIcon: {
    width: 48,
    height: 48,
    background: "#dcfce7",
    color: "#16a34a",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.25rem",
    margin: "0 auto 1rem",
    fontWeight: 700,
  },
  position: { color: "#475569", fontSize: "1rem", marginBottom: "1rem" },
  body: { color: "#475569", fontSize: "0.875rem", marginBottom: "0.75rem" },
  referralRow: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    marginBottom: "0.75rem",
  },
  code: {
    flex: 1,
    fontSize: "0.75rem",
    color: "#475569",
    wordBreak: "break-all",
    fontFamily: "monospace",
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
};

// ---------------------------------------------------------------------------
// Mount to DOM (for standalone demo — in Next.js / Vite just export App)
// ---------------------------------------------------------------------------
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<App />);
}

export default App;
