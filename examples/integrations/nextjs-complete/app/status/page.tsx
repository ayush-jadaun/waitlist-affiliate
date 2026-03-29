/**
 * app/status/page.tsx — Referral status page
 *
 * Shows a subscriber's current position, referral count, earned rewards,
 * and a shareable referral link.
 *
 * URL: /status?email=you@example.com
 *
 * Copy to: your-next-app/app/status/page.tsx
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReferralStatus } from "@waitlist/react";
import { WaitlistClient } from "@waitlist/sdk";
import type { SubscriberStatusResponse } from "@waitlist/sdk";

const API_KEY  = process.env.NEXT_PUBLIC_WAITLIST_API_KEY  ?? "";
const BASE_URL = process.env.NEXT_PUBLIC_WAITLIST_BASE_URL ?? "http://localhost:3400";

export default function StatusPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  // -------------------------------------------------------------------------
  // Option A: Use the built-in ReferralStatus component (simplest)
  //           It reads the WaitlistClient from WaitlistProvider context.
  //
  //   <ReferralStatus email={email} className="my-status" />
  //
  // Option B: Fetch manually for full control (shown below)
  // -------------------------------------------------------------------------
  const [status, setStatus]   = useState<SubscriberStatusResponse | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [copied, setCopied]   = useState(false);

  const client = new WaitlistClient({ apiKey: API_KEY, baseUrl: BASE_URL });

  const fetchStatus = useCallback(() => {
    if (!email) return;
    client
      .getStatus(email)
      .then(setStatus)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load")
      );
  }, [email]);

  useEffect(() => {
    fetchStatus();
    // Refresh every 60 seconds so the status stays live
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (!email) {
    return (
      <NoEmailState />
    );
  }

  if (error) {
    return (
      <PageShell>
        <div style={styles.card}>
          <h1 style={styles.h1}>Status not found</h1>
          <p style={styles.body}>{error}</p>
          <p style={styles.body}>
            Make sure you signed up with <strong>{email}</strong>.
          </p>
          <Link href="/" style={styles.link}>← Back to waitlist</Link>
        </div>
      </PageShell>
    );
  }

  if (!status) {
    return (
      <PageShell>
        <div style={styles.card}>
          <p style={styles.muted}>Loading your status…</p>
        </div>
      </PageShell>
    );
  }

  const referralUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/?ref=${status.referralCode}`;

  function copyLink() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <PageShell>
      {/* Position card */}
      <div style={styles.card}>
        {status.position !== null ? (
          <div style={styles.positionWrap}>
            <span style={styles.positionNum}>#{status.position}</span>
            <span style={styles.positionLabel}>on the waitlist</span>
          </div>
        ) : (
          <p style={styles.positionLabel}>Your application is under review.</p>
        )}
        <div style={styles.statusPill(status.status)}>{status.status}</div>
      </div>

      {/* Referral progress */}
      <div style={styles.card}>
        <div style={styles.statRow}>
          <div style={styles.stat}>
            <span style={styles.statNum}>{status.referralCount}</span>
            <span style={styles.statLabel}>Referrals</span>
          </div>
          {status.rewards.length > 0 && (
            <div style={styles.stat}>
              <span style={styles.statNum}>{status.rewards.length}</span>
              <span style={styles.statLabel}>Rewards</span>
            </div>
          )}
        </div>

        {status.rewards.length > 0 && (
          <div style={styles.rewardList}>
            {status.rewards.map((r) => (
              <span key={r} style={styles.rewardChip}>{r}</span>
            ))}
          </div>
        )}
      </div>

      {/* Share card */}
      <div style={styles.card}>
        <h2 style={styles.h2}>Share to move up</h2>
        <p style={styles.muted}>Every referral bumps you up the list.</p>
        <div style={styles.linkBox}>
          <code style={styles.linkCode}>{referralUrl}</code>
          <button style={styles.copyBtn} onClick={copyLink}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <div style={styles.shareRow}>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I'm on the waitlist! Join me: ${referralUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.twitterBtn}
          >
            Share on X
          </a>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`Join the waitlist with me: ${referralUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.whatsappBtn}
          >
            WhatsApp
          </a>
        </div>
      </div>

      <Link href="/" style={styles.backLink}>← Back to homepage</Link>
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main style={styles.main}>
      <h1 style={styles.pageTitle}>Your Waitlist Status</h1>
      {children}
    </main>
  );
}

function NoEmailState() {
  const [email, setEmail] = useState("");

  return (
    <main style={styles.main}>
      <h1 style={styles.pageTitle}>Check Your Status</h1>
      <div style={styles.card}>
        <p style={styles.body}>Enter the email you signed up with.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = `/status?email=${encodeURIComponent(email)}`;
          }}
          style={styles.emailForm}
        >
          <input
            style={styles.input}
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button style={styles.submitBtn} type="submit">Check</button>
        </form>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = {
  main: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "4rem 1.5rem",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  pageTitle: { fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", marginBottom: "0.5rem" },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    padding: "1.5rem",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  positionWrap: { textAlign: "center" as const, paddingBottom: "0.5rem" },
  positionNum: { display: "block", fontSize: "3rem", fontWeight: 800, color: "#0f172a" },
  positionLabel: { fontSize: "0.875rem", color: "#64748b", display: "block", textAlign: "center" as const, marginTop: "0.25rem" },
  statusPill: (status: string): React.CSSProperties => ({
    display: "block",
    margin: "0.75rem auto 0",
    textAlign: "center",
    width: "fit-content",
    padding: "0.2rem 0.875rem",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "capitalize",
    background: status === "approved" ? "#dcfce7" : status === "waiting" ? "#f1f5f9" : "#fef9c3",
    color: status === "approved" ? "#15803d" : status === "waiting" ? "#334155" : "#854d0e",
  }),
  statRow: { display: "flex", gap: "2rem" },
  stat: { display: "flex", flexDirection: "column" as const, gap: "0.125rem" },
  statNum: { fontSize: "2rem", fontWeight: 800, color: "#0f172a" },
  statLabel: { fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.05em" },
  rewardList: { display: "flex", gap: "0.5rem", flexWrap: "wrap" as const, marginTop: "1rem" },
  rewardChip: {
    background: "#fef9c3",
    border: "1px solid #fde047",
    color: "#713f12",
    borderRadius: "0.375rem",
    padding: "0.2rem 0.6rem",
    fontSize: "0.8rem",
    fontWeight: 600,
  },
  h2: { fontSize: "1rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.25rem" },
  h1: { fontSize: "1.25rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" },
  body: { color: "#475569", marginBottom: "0.75rem" },
  muted: { color: "#94a3b8", fontSize: "0.875rem", marginBottom: "0.75rem" },
  linkBox: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    margin: "0.75rem 0",
  },
  linkCode: { flex: 1, fontFamily: "monospace", fontSize: "0.75rem", color: "#475569", wordBreak: "break-all" as const },
  copyBtn: { padding: "0.25rem 0.75rem", background: "#4a9eff", color: "#fff", border: "none", borderRadius: "0.25rem", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap" as const },
  shareRow: { display: "flex", gap: "0.5rem", flexWrap: "wrap" as const },
  twitterBtn: { padding: "0.45rem 1rem", background: "#000", color: "#fff", borderRadius: "0.375rem", textDecoration: "none", fontSize: "0.8rem", fontWeight: 600 },
  whatsappBtn: { padding: "0.45rem 1rem", background: "#25d366", color: "#fff", borderRadius: "0.375rem", textDecoration: "none", fontSize: "0.8rem", fontWeight: 600 },
  link: { color: "#4a9eff", textDecoration: "none", fontSize: "0.875rem" },
  backLink: { color: "#4a9eff", textDecoration: "none", fontSize: "0.875rem", marginTop: "0.5rem" },
  emailForm: { display: "flex", gap: "0.5rem", marginTop: "0.75rem" },
  input: { flex: 1, padding: "0.55rem 0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.375rem", fontSize: "0.9rem" },
  submitBtn: { padding: "0.55rem 1.25rem", background: "#4a9eff", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" },
};
