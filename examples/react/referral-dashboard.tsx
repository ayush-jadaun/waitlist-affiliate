/**
 * examples/react/referral-dashboard.tsx
 *
 * Full referral dashboard using ReferralStatus + custom UI.
 *
 * Features:
 *   - Shows position on the waitlist
 *   - Referral count and progress bar toward the next reward tier
 *   - Unlocked reward badges
 *   - Share buttons (copy link, Twitter, WhatsApp)
 *   - A/B experiment variant display
 *   - Auto-refresh every 30 seconds
 */

import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { WaitlistProvider, ReferralStatus } from "@waitlist/react";
import { WaitlistClient } from "@waitlist/sdk";
import type { SubscriberStatusResponse } from "@waitlist/sdk";

const API_KEY  = "wl_pk_your-api-key";
const BASE_URL = "http://localhost:3400";

// These match the reward tiers you configured in the admin panel.
// Hardcode or fetch from /api/v1/stats if you expose them publicly.
const REWARD_TIERS = [
  { threshold: 1,  label: "Early Bird",    emoji: "🐦" },
  { threshold: 5,  label: "Referral Pro",  emoji: "⭐" },
  { threshold: 10, label: "VIP Access",    emoji: "👑" },
  { threshold: 25, label: "Legend",        emoji: "🏆" },
];

// ---------------------------------------------------------------------------
// Dashboard page — requires the user's email (from a cookie / query param /
// local storage after they subscribed).
// ---------------------------------------------------------------------------
export function DashboardPage() {
  // In a real app, get email from a cookie, session, or URL param.
  const emailParam =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("email") ?? ""
      : "";

  const [email, setEmail] = useState(emailParam);
  const [submitted, setSubmitted] = useState(Boolean(emailParam));

  if (!submitted) {
    return (
      <WaitlistProvider apiKey={API_KEY} baseUrl={BASE_URL}>
        <div style={styles.page}>
          <div style={styles.emailGate}>
            <h2 style={styles.h2}>Check your status</h2>
            <p style={styles.muted}>Enter the email you signed up with.</p>
            <form
              onSubmit={(e) => { e.preventDefault(); setSubmitted(true); }}
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
              <button style={styles.primaryBtn} type="submit">Check Status</button>
            </form>
          </div>
        </div>
      </WaitlistProvider>
    );
  }

  return (
    <WaitlistProvider apiKey={API_KEY} baseUrl={BASE_URL}>
      <Dashboard email={email} />
    </WaitlistProvider>
  );
}

// ---------------------------------------------------------------------------
// Dashboard — the full referral UI once we have the email
// ---------------------------------------------------------------------------
function Dashboard({ email }: { email: string }) {
  const [status, setStatus] = useState<SubscriberStatusResponse | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch status manually so we can refresh it
  const client = new WaitlistClient({ apiKey: API_KEY, baseUrl: BASE_URL });

  const fetchStatus = useCallback(() => {
    client
      .getStatus(email)
      .then(setStatus)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [email]);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds
    const timer = setInterval(fetchStatus, 30_000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.errorText}>{error}</p>
          <p style={styles.muted}>Make sure you signed up with this email address.</p>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={styles.muted}>Loading your status…</p>
        </div>
      </div>
    );
  }

  const referralUrl = `${window.location.origin}/?ref=${status.referralCode}`;
  const nextTier = REWARD_TIERS.find((t) => t.threshold > status.referralCount);
  const progressPct = nextTier
    ? Math.min(100, (status.referralCount / nextTier.threshold) * 100)
    : 100;

  function copyLink() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareTwitter() {
    const text = encodeURIComponent(
      `I'm on the waitlist! Join me: ${referralUrl}`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank", "noopener");
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(`Join me on the waitlist: ${referralUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
  }

  return (
    <div style={styles.page}>
      {/* ---- Header ---- */}
      <div style={styles.card}>
        <div style={styles.positionBadge}>
          {status.position !== null ? (
            <>
              <span style={styles.positionNumber}>#{status.position}</span>
              <span style={styles.positionLabel}>on the waitlist</span>
            </>
          ) : (
            <span style={styles.positionLabel}>Under review</span>
          )}
        </div>
        <div style={styles.statusPill(status.status)}>{status.status}</div>
      </div>

      {/* ---- Referral progress ---- */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Referrals</h3>
        <p style={styles.bigNumber}>{status.referralCount}</p>
        <p style={styles.muted}>
          {nextTier
            ? `${nextTier.threshold - status.referralCount} more to unlock "${nextTier.label}" ${nextTier.emoji}`
            : "You've unlocked all reward tiers!"}
        </p>
        <div style={styles.progressTrack}>
          <div style={styles.progressFill(progressPct)} />
        </div>
      </div>

      {/* ---- Rewards ---- */}
      {status.rewards.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Unlocked Rewards</h3>
          <div style={styles.rewardGrid}>
            {status.rewards.map((reward) => {
              const tier = REWARD_TIERS.find((t) => t.label === reward);
              return (
                <div key={reward} style={styles.rewardBadge}>
                  <span>{tier?.emoji ?? "🎁"}</span>
                  <span style={styles.rewardLabel}>{reward}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- Share ---- */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Share to Move Up</h3>
        <div style={styles.referralLinkBox}>
          <code style={styles.referralLinkText}>{referralUrl}</code>
        </div>
        <div style={styles.shareRow}>
          <button style={styles.copyBtn} onClick={copyLink}>
            {copied ? "Copied!" : "Copy Link"}
          </button>
          <button style={styles.twitterBtn} onClick={shareTwitter}>
            Share on X
          </button>
          <button style={styles.whatsappBtn} onClick={shareWhatsApp}>
            WhatsApp
          </button>
        </div>
      </div>

      {/* ---- A/B experiment indicator (dev/debug) ---- */}
      {status.experiment && (
        <div style={styles.experimentBadge}>
          Experiment: <strong>{status.experiment.name}</strong> → {status.experiment.variant}
        </div>
      )}

      {/*
        Alternatively — use the built-in ReferralStatus component for a
        quick, no-frills display of the same data:

        <ReferralStatus
          email={email}
          className="my-status-widget"
        />
      */}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const BASE: React.CSSProperties = {
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const styles = {
  page: {
    ...BASE,
    maxWidth: 480,
    margin: "0 auto",
    padding: "2rem 1rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "1rem",
  },
  emailGate: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    padding: "2rem",
    textAlign: "center" as const,
  },
  emailForm: { display: "flex", gap: "0.5rem", marginTop: "1rem" },
  input: {
    flex: 1,
    padding: "0.6rem 0.75rem",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    fontSize: "0.9rem",
  },
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.75rem",
    padding: "1.5rem",
  },
  cardTitle: { fontSize: "0.8rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: "0.75rem" },
  positionBadge: { textAlign: "center" as const, padding: "1rem 0" },
  positionNumber: { fontSize: "3rem", fontWeight: 800, color: "#0f172a", display: "block" },
  positionLabel: { fontSize: "0.875rem", color: "#64748b" },
  statusPill: (status: string): React.CSSProperties => ({
    display: "inline-block",
    marginTop: "0.5rem",
    padding: "0.2rem 0.75rem",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    background: status === "approved" ? "#dcfce7" : status === "waiting" ? "#f1f5f9" : "#fef9c3",
    color: status === "approved" ? "#15803d" : status === "waiting" ? "#475569" : "#854d0e",
  }),
  bigNumber: { fontSize: "2.5rem", fontWeight: 800, color: "#0f172a", margin: "0.25rem 0" },
  muted: { color: "#94a3b8", fontSize: "0.875rem" },
  progressTrack: {
    height: 8,
    background: "#f1f5f9",
    borderRadius: "999px",
    overflow: "hidden",
    marginTop: "0.75rem",
  },
  progressFill: (pct: number): React.CSSProperties => ({
    height: "100%",
    width: `${pct}%`,
    background: "linear-gradient(90deg, #4a9eff, #7c3aed)",
    borderRadius: "999px",
    transition: "width 0.4s ease",
  }),
  rewardGrid: { display: "flex", gap: "0.75rem", flexWrap: "wrap" as const },
  rewardBadge: {
    display: "flex",
    alignItems: "center",
    gap: "0.35rem",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "0.5rem",
    padding: "0.35rem 0.75rem",
    fontSize: "0.875rem",
  },
  rewardLabel: { fontWeight: 600, color: "#334155" },
  referralLinkBox: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    marginBottom: "0.75rem",
    overflow: "hidden",
  },
  referralLinkText: {
    fontSize: "0.75rem",
    color: "#475569",
    wordBreak: "break-all" as const,
    fontFamily: "monospace",
  },
  shareRow: { display: "flex", gap: "0.5rem", flexWrap: "wrap" as const },
  primaryBtn: { padding: "0.55rem 1.25rem", background: "#4a9eff", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600, fontSize: "0.875rem" },
  copyBtn: { padding: "0.5rem 1rem", background: "#4a9eff", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" },
  twitterBtn: { padding: "0.5rem 1rem", background: "#000", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" },
  whatsappBtn: { padding: "0.5rem 1rem", background: "#25d366", color: "#fff", border: "none", borderRadius: "0.375rem", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" },
  h2: { fontSize: "1.125rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" },
  errorText: { color: "#dc2626", fontWeight: 600 },
  experimentBadge: {
    background: "#fef9c3",
    border: "1px solid #fde047",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    fontSize: "0.75rem",
    color: "#713f12",
    textAlign: "center" as const,
  },
};

// Mount
const root = document.getElementById("root");
if (root) createRoot(root).render(<DashboardPage />);

export default DashboardPage;
