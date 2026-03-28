import { describe, it, expect } from "vitest";
import { hashApiKey } from "../middleware/api-key.js";

describe("hashApiKey", () => {
  // ── Determinism ────────────────────────────────────────────────────────────
  describe("determinism", () => {
    it("produces the same hash for the same input", () => {
      const key = "wl_pk_someLongApiKey123456789";
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it("calling three times with the same input yields identical results", () => {
      const key = "wl_sk_anotherKey987";
      const a = hashApiKey(key);
      const b = hashApiKey(key);
      const c = hashApiKey(key);
      expect(a).toBe(b);
      expect(b).toBe(c);
    });
  });

  // ── Output format ──────────────────────────────────────────────────────────
  describe("output format", () => {
    it("returns a hex string of exactly 64 characters (SHA-256)", () => {
      expect(hashApiKey("test-key")).toHaveLength(64);
    });

    it("output contains only lowercase hex characters", () => {
      expect(hashApiKey("test-key")).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns 64-char hex for empty string", () => {
      const hash = hashApiKey("");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns 64-char hex for a very long string (1000 chars)", () => {
      const longKey = "k".repeat(1000);
      const hash = hashApiKey(longKey);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("returns 64-char hex for special characters", () => {
      const specialKey = "!@#$%^&*()_+-={}[]|:;\"'<>,.?/`~";
      const hash = hashApiKey(specialKey);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ── Uniqueness / sensitivity ────────────────────────────────────────────────
  describe("different inputs → different hashes", () => {
    it("different API keys produce different hashes", () => {
      expect(hashApiKey("key-one")).not.toBe(hashApiKey("key-two"));
    });

    it("one-character difference produces a different hash", () => {
      expect(hashApiKey("wl_pk_abc")).not.toBe(hashApiKey("wl_pk_abX"));
    });

    it("empty string has a different hash from a non-empty string", () => {
      expect(hashApiKey("")).not.toBe(hashApiKey("x"));
    });

    it("case sensitivity — uppercase produces different hash from lowercase", () => {
      expect(hashApiKey("MyApiKey")).not.toBe(hashApiKey("myapikey"));
    });

    it("whitespace difference produces different hash", () => {
      expect(hashApiKey("key")).not.toBe(hashApiKey("key "));
    });
  });

  // ── Known SHA-256 value ────────────────────────────────────────────────────
  describe("known values", () => {
    it("produces the correct SHA-256 hash for empty string", () => {
      // SHA-256 of empty string is well-known
      expect(hashApiKey("")).toBe(
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      );
    });

    it("produces the correct SHA-256 hash for 'hello'", () => {
      expect(hashApiKey("hello")).toBe(
        "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
      );
    });
  });

  // ── Special inputs ─────────────────────────────────────────────────────────
  describe("special inputs", () => {
    it("handles a unicode string without throwing", () => {
      expect(() => hashApiKey("日本語テスト🚀")).not.toThrow();
      expect(hashApiKey("日本語テスト🚀")).toHaveLength(64);
    });

    it("handles a newline character", () => {
      expect(hashApiKey("key\nwith\nnewlines")).toHaveLength(64);
    });

    it("handles a tab character", () => {
      expect(hashApiKey("key\twith\ttabs")).toHaveLength(64);
    });

    it("handles a null byte in string", () => {
      expect(hashApiKey("key\0null")).toHaveLength(64);
    });
  });
});
