/**
 * examples/react/standalone-form.tsx
 *
 * WaitlistForm without WaitlistProvider.
 *
 * When you pass apiKey and baseUrl directly as props, WaitlistForm creates
 * its own WaitlistClient instance. Use this pattern when:
 *   - You only have one form and don't want the extra Provider wrapper.
 *   - You embed the waitlist as a standalone widget in a larger app.
 *   - You need different API keys for different forms on the same page.
 */

import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { WaitlistForm } from "@waitlist/react";
import type { SubscribeResponse } from "@waitlist/sdk";

// ---------------------------------------------------------------------------
// Configuration — in a real app these come from environment variables
// ---------------------------------------------------------------------------
const API_KEY  = import.meta.env?.VITE_WAITLIST_API_KEY  ?? "wl_pk_your-api-key";
const BASE_URL = import.meta.env?.VITE_WAITLIST_BASE_URL ?? "http://localhost:3400";

// ---------------------------------------------------------------------------
// StandaloneWaitlistForm
//
// Self-contained — no Provider required.  Reads the ?ref= param from the URL
// and passes it to WaitlistForm automatically.
// ---------------------------------------------------------------------------
export function StandaloneWaitlistForm() {
  const [result, setResult] = useState<SubscribeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Extract the referral code from the URL query string
  const [referralCode, setReferralCode] = useState<string | undefined>();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReferralCode(params.get("ref") ?? undefined);
  }, []);

  if (result) {
    return (
      <div style={styles.card}>
        <h3 style={styles.heading}>You're in!</h3>
        {result.position !== null && (
          <p style={styles.body}>Your position: <strong>#{result.position}</strong></p>
        )}
        <p style={styles.body}>
          Referral code: <code style={styles.code}>{result.referralCode}</code>
        </p>
        <p style={styles.hint}>Share your code to move up the list.</p>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <h3 style={styles.heading}>Join the Waitlist</h3>
      <p style={styles.body}>Be the first to know when we launch.</p>

      {error && (
        <p role="alert" style={styles.error}>
          {error}
        </p>
      )}

      {/*
        Pass apiKey + baseUrl directly instead of using a Provider.

        WaitlistForm checks for a WaitlistContext first; if none is found it
        creates its own client from the apiKey/baseUrl props.  This means the
        form is completely self-contained.
      */}
      <WaitlistForm
        apiKey={API_KEY}
        baseUrl={BASE_URL}
        referralCode={referralCode}
        className="standalone-form"
        onSuccess={(res) => {
          setError(null);
          setResult(res);
        }}
        onError={(err) => setError(err.message)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Embed multiple standalone forms on one page, each pointing at a
// different waitlist project.
// ---------------------------------------------------------------------------
export function MultiProjectPage() {
  return (
    <div style={styles.page}>
      <h1 style={styles.pageTitle}>Our Products</h1>

      <div style={styles.grid}>
        {/* Product A — its own API key / project */}
        <div>
          <h2 style={styles.productName}>Product A</h2>
          <WaitlistForm
            apiKey="wl_pk_product-a-key"
            baseUrl="http://localhost:3400"
            onSuccess={(r) => console.log("Product A joined:", r.referralCode)}
            onError={(e) => console.error("Product A error:", e.message)}
          />
        </div>

        {/* Product B — different API key / project */}
        <div>
          <h2 style={styles.productName}>Product B</h2>
          <WaitlistForm
            apiKey="wl_pk_product-b-key"
            baseUrl="http://localhost:3400"
            onSuccess={(r) => console.log("Product B joined:", r.referralCode)}
            onError={(e) => console.error("Product B error:", e.message)}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  page: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    maxWidth: 760,
    margin: "0 auto",
    padding: "2rem",
  },
  pageTitle: { fontSize: "1.75rem", fontWeight: 800, color: "#0f172a", marginBottom: "1.5rem" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" },
  productName: { fontSize: "1rem", fontWeight: 700, color: "#334155", marginBottom: "0.75rem" },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    padding: "1.5rem",
    maxWidth: 400,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  heading: { fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" },
  body: { color: "#475569", fontSize: "0.9rem", marginBottom: "0.75rem" },
  hint: { color: "#94a3b8", fontSize: "0.75rem", marginTop: "0.5rem" },
  code: {
    background: "#f1f5f9",
    padding: "0.1rem 0.35rem",
    borderRadius: "0.25rem",
    fontFamily: "monospace",
    fontSize: "0.85rem",
  },
  error: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.875rem",
    marginBottom: "0.75rem",
  },
};

// ---------------------------------------------------------------------------
// Mount the standalone form for demo purposes
// ---------------------------------------------------------------------------
const root = document.getElementById("root");
if (root) {
  createRoot(root).render(<StandaloneWaitlistForm />);
}
