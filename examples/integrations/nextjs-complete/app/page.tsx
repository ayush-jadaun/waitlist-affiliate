/**
 * app/page.tsx — Landing page with WaitlistForm
 *
 * This is a Server Component (no "use client") for fast initial render.
 * The interactive form lives in a separate client component so the rest of
 * the page benefits from server-side rendering.
 *
 * Copy to: your-next-app/app/page.tsx
 */

import { Suspense } from "react";
import { WaitlistSection } from "./WaitlistSection";

// Next.js App Router passes searchParams as a prop to page components.
// We use it to read the ?ref= referral code from the URL.
export default function HomePage({
  searchParams,
}: {
  searchParams?: { ref?: string };
}) {
  const referralCode = searchParams?.ref;

  return (
    <main style={styles.main}>
      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.badge}>Coming Soon</div>
        <h1 style={styles.h1}>The product you've been waiting for.</h1>
        <p style={styles.tagline}>
          Join {referralCode ? "your friend and" : ""} thousands of early adopters
          on the waitlist. Be first in line when we launch.
        </p>
      </section>

      {/* Waitlist form (client component) */}
      <Suspense fallback={<div style={styles.formPlaceholder}>Loading…</div>}>
        <WaitlistSection referralCode={referralCode} />
      </Suspense>

      {/* Social proof */}
      <section style={styles.proof}>
        <div style={styles.proofStat}><strong>2,400+</strong> people waiting</div>
        <div style={styles.proofDot} />
        <div style={styles.proofStat}><strong>38%</strong> joined via referral</div>
        <div style={styles.proofDot} />
        <div style={styles.proofStat}><strong>No spam</strong>, ever</div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    maxWidth: 540,
    margin: "0 auto",
    padding: "5rem 1.5rem 3rem",
  },
  hero: { textAlign: "center", marginBottom: "2.5rem" },
  badge: {
    display: "inline-block",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: "999px",
    padding: "0.25rem 0.875rem",
    fontSize: "0.75rem",
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    marginBottom: "1.25rem",
  },
  h1: {
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.2,
    margin: "0 0 1rem",
  },
  tagline: {
    fontSize: "1.0625rem",
    color: "#475569",
    lineHeight: 1.65,
    maxWidth: 420,
    margin: "0 auto",
  },
  formPlaceholder: {
    height: 180,
    background: "#f8fafc",
    borderRadius: "0.75rem",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: "0.875rem",
  },
  proof: {
    marginTop: "2rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    flexWrap: "wrap",
  },
  proofStat: { fontSize: "0.875rem", color: "#64748b" },
  proofDot: { width: 4, height: 4, background: "#cbd5e1", borderRadius: "50%" },
};
