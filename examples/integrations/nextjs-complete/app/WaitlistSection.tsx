/**
 * app/WaitlistSection.tsx — Client component: the signup form + success state
 *
 * Separated from page.tsx so only this component is a client component while
 * the rest of the page remains server-rendered.
 *
 * Copy to: your-next-app/app/WaitlistSection.tsx
 */

"use client";

import { useState } from "react";
import { WaitlistForm } from "@waitlist/react";
import type { SubscribeResponse } from "@waitlist/sdk";

interface WaitlistSectionProps {
  referralCode?: string;
}

export function WaitlistSection({ referralCode }: WaitlistSectionProps) {
  const [result, setResult] = useState<SubscribeResponse | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const referralUrl = result
    ? `${window.location.origin}/?ref=${result.referralCode}`
    : "";

  function handleCopy() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (result) {
    return (
      <div style={styles.card}>
        <div style={styles.successIcon} aria-hidden>✓</div>
        <h2 style={styles.h2}>You're on the list!</h2>

        {result.position !== null && (
          <p style={styles.body}>
            You're <strong>#{result.position}</strong> — share to move up.
          </p>
        )}

        <div style={styles.linkBox}>
          <code style={styles.linkCode}>{referralUrl}</code>
          <button style={styles.copyBtn} onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div style={styles.shareRow}>
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`I just joined the waitlist! ${referralUrl}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.twitterBtn}
          >
            Share on X
          </a>
          <a
            href={`/status?email=${encodeURIComponent(result.email)}`}
            style={styles.statusLink}
          >
            View my status →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      {error && (
        <div role="alert" style={styles.errorBox}>
          {error}
        </div>
      )}

      {referralCode && (
        <div style={styles.referralNotice}>
          You were referred! Sign up to give your friend credit.
        </div>
      )}

      {/*
        WaitlistForm reads the WaitlistClient from the WaitlistProvider
        in WaitlistProviders.tsx → layout.tsx. No apiKey/baseUrl needed here.
      */}
      <WaitlistForm
        referralCode={referralCode}
        onSuccess={(res) => { setError(null); setResult(res); }}
        onError={(err) => setError(err.message)}
        className="landing-waitlist-form"
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: "0.875rem",
    padding: "2rem",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  },
  successIcon: {
    width: 52,
    height: 52,
    background: "#dcfce7",
    color: "#15803d",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.375rem",
    fontWeight: 700,
    margin: "0 auto 1rem",
  },
  h2: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#0f172a",
    textAlign: "center",
    marginBottom: "0.5rem",
  },
  body: { color: "#475569", textAlign: "center", marginBottom: "1.25rem" },
  linkBox: {
    display: "flex",
    gap: "0.5rem",
    alignItems: "center",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "0.375rem",
    padding: "0.5rem 0.75rem",
    marginBottom: "1rem",
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
  shareRow: {
    display: "flex",
    gap: "0.75rem",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  twitterBtn: {
    padding: "0.5rem 1.25rem",
    background: "#000",
    color: "#fff",
    borderRadius: "0.375rem",
    textDecoration: "none",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  statusLink: {
    color: "#4a9eff",
    textDecoration: "none",
    fontSize: "0.875rem",
    fontWeight: 500,
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    borderRadius: "0.375rem",
    padding: "0.6rem 0.875rem",
    fontSize: "0.875rem",
    marginBottom: "1rem",
  },
  referralNotice: {
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e40af",
    borderRadius: "0.375rem",
    padding: "0.6rem 0.875rem",
    fontSize: "0.875rem",
    marginBottom: "1rem",
    textAlign: "center",
  },
};
