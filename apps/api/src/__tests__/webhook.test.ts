import { describe, it, expect } from "vitest";
import { signPayload, verifySignature } from "../services/webhook.js";

// ── signPayload ───────────────────────────────────────────────────────────────
describe("signPayload", () => {
  describe("signature format", () => {
    it("returns a string starting with 'sha256='", () => {
      const sig = signPayload("hello", "secret");
      expect(sig.startsWith("sha256=")).toBe(true);
    });

    it("hex digest is exactly 64 characters (SHA-256 produces 32 bytes)", () => {
      const sig = signPayload("hello", "secret");
      expect(sig.slice("sha256=".length)).toHaveLength(64);
    });

    it("full signature is exactly 71 characters ('sha256=' + 64 hex)", () => {
      const sig = signPayload("hello", "secret");
      expect(sig).toHaveLength(71);
    });

    it("digest contains only lowercase hex characters", () => {
      const sig = signPayload("any payload", "any secret");
      expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });

  describe("determinism", () => {
    it("same payload + secret always produces the same signature", () => {
      const payload = '{"type":"subscriber.created"}';
      const secret = "my-secret";
      expect(signPayload(payload, secret)).toBe(signPayload(payload, secret));
    });

    it("calling three times yields identical results", () => {
      const a = signPayload("abc", "xyz");
      const b = signPayload("abc", "xyz");
      const c = signPayload("abc", "xyz");
      expect(a).toBe(b);
      expect(b).toBe(c);
    });
  });

  describe("sensitivity to changes", () => {
    it("different payloads produce different signatures", () => {
      const secret = "shared-secret";
      const sig1 = signPayload("payload-one", secret);
      const sig2 = signPayload("payload-two", secret);
      expect(sig1).not.toBe(sig2);
    });

    it("different secrets produce different signatures", () => {
      const payload = "same payload";
      const sig1 = signPayload(payload, "secret-a");
      const sig2 = signPayload(payload, "secret-b");
      expect(sig1).not.toBe(sig2);
    });

    it("one extra character in payload changes the signature", () => {
      const sig1 = signPayload("hello", "secret");
      const sig2 = signPayload("hello!", "secret");
      expect(sig1).not.toBe(sig2);
    });

    it("one extra character in secret changes the signature", () => {
      const sig1 = signPayload("payload", "secret");
      const sig2 = signPayload("payload", "secretX");
      expect(sig1).not.toBe(sig2);
    });
  });

  describe("special inputs", () => {
    it("signs an empty payload without throwing", () => {
      expect(() => signPayload("", "secret")).not.toThrow();
      expect(signPayload("", "secret")).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("signs with an empty secret without throwing", () => {
      expect(() => signPayload("payload", "")).not.toThrow();
      expect(signPayload("payload", "")).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("both empty — still returns a valid signature", () => {
      expect(signPayload("", "")).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("signs a unicode payload", () => {
      const unicodePayload = '{"name":"日本語テスト","emoji":"🚀"}';
      expect(signPayload(unicodePayload, "secret")).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("signs a very large payload (10 KB) without throwing", () => {
      const bigPayload = "x".repeat(10_240);
      expect(() => signPayload(bigPayload, "secret")).not.toThrow();
      expect(signPayload(bigPayload, "secret")).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("signs with special characters in secret", () => {
      const specialSecret = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
      expect(signPayload("payload", specialSecret)).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("signs a JSON payload (realistic usage)", () => {
      const json = JSON.stringify({ type: "subscriber.created", data: { email: "test@example.com" } });
      expect(signPayload(json, "webhook-secret")).toMatch(/^sha256=[a-f0-9]{64}$/);
    });
  });
});

// ── verifySignature ───────────────────────────────────────────────────────────
describe("verifySignature", () => {
  const secret = "test-secret-key-for-webhooks";
  const payload = JSON.stringify({ type: "subscriber.created", data: { email: "test@example.com" } });

  describe("correct inputs → true", () => {
    it("returns true for a correctly signed payload", () => {
      const sig = signPayload(payload, secret);
      expect(verifySignature(payload, secret, sig)).toBe(true);
    });

    it("round-trips correctly for an empty payload", () => {
      const sig = signPayload("", secret);
      expect(verifySignature("", secret, sig)).toBe(true);
    });

    it("round-trips correctly for a unicode payload", () => {
      const uPayload = '{"emoji":"🚀"}';
      const sig = signPayload(uPayload, secret);
      expect(verifySignature(uPayload, secret, sig)).toBe(true);
    });

    it("round-trips correctly for a 10 KB payload", () => {
      const big = "y".repeat(10_240);
      const sig = signPayload(big, secret);
      expect(verifySignature(big, secret, sig)).toBe(true);
    });
  });

  describe("wrong inputs → false", () => {
    it("returns false for a wrong but correctly-formatted signature", () => {
      const wrongSig = "sha256=" + "a".repeat(64);
      expect(verifySignature(payload, secret, wrongSig)).toBe(false);
    });

    it("returns false when the payload is different", () => {
      const sig = signPayload(payload, secret);
      expect(verifySignature("different payload", secret, sig)).toBe(false);
    });

    it("returns false when the secret is different", () => {
      const sig = signPayload(payload, secret);
      expect(verifySignature(payload, "wrong-secret", sig)).toBe(false);
    });

    it("returns false for a one-character change in payload", () => {
      const sig = signPayload(payload, secret);
      const tamperedPayload = payload.slice(0, -1) + "X";
      expect(verifySignature(tamperedPayload, secret, sig)).toBe(false);
    });

    it("returns false for a one-character flip in the signature hex", () => {
      const sig = signPayload(payload, secret);
      // Flip the last hex character
      const lastChar = sig[sig.length - 1]!;
      const flipped = lastChar === "a" ? "b" : "a";
      const tampered = sig.slice(0, -1) + flipped;
      expect(verifySignature(payload, secret, tampered)).toBe(false);
    });
  });

  describe("completely invalid signature format → false", () => {
    it("returns false when signature has no 'sha256=' prefix", () => {
      const rawHex = "a".repeat(64);
      // Buffer lengths differ → timingSafeEqual throws → caught → false
      expect(verifySignature(payload, secret, rawHex)).toBe(false);
    });

    it("returns false for an empty signature string", () => {
      expect(verifySignature(payload, secret, "")).toBe(false);
    });

    it("returns false for 'sha256=' prefix only (no digest)", () => {
      expect(verifySignature(payload, secret, "sha256=")).toBe(false);
    });

    it("returns false for a completely random string", () => {
      expect(verifySignature(payload, secret, "not-a-valid-signature-at-all")).toBe(false);
    });

    it("returns false for 'sha256=' + wrong length hex (32 chars)", () => {
      expect(verifySignature(payload, secret, "sha256=" + "f".repeat(32))).toBe(false);
    });

    it("returns false for empty payload and empty secret with wrong signature", () => {
      expect(verifySignature("", "", "sha256=" + "0".repeat(64))).toBe(false);
    });

    it("handles buffer length mismatch gracefully (returns false, not throw)", () => {
      // Signature of different length → timingSafeEqual throws → caught → false
      expect(verifySignature(payload, secret, "sha256=abc")).toBe(false);
    });
  });

  describe("empty string inputs", () => {
    it("verifies correctly when payload is empty string", () => {
      const sig = signPayload("", secret);
      expect(verifySignature("", secret, sig)).toBe(true);
    });

    it("returns false when payload is empty but signature was computed on non-empty", () => {
      const sig = signPayload("non-empty", secret);
      expect(verifySignature("", secret, sig)).toBe(false);
    });

    it("verifies correctly when secret is empty string", () => {
      const sig = signPayload(payload, "");
      expect(verifySignature(payload, "", sig)).toBe(true);
    });
  });
});
