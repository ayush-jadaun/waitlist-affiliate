import { describe, it, expect } from "vitest";
import { generateReferralCode, generateApiKey } from "../lib/referral-code.js";
import { REFERRAL_CODE_LENGTH } from "@waitlist/shared";

// ── generateReferralCode ──────────────────────────────────────────────────────
describe("generateReferralCode", () => {
  describe("length", () => {
    it(`length is exactly REFERRAL_CODE_LENGTH (${REFERRAL_CODE_LENGTH})`, () => {
      expect(generateReferralCode()).toHaveLength(REFERRAL_CODE_LENGTH);
    });

    it("every generated code has consistent length", () => {
      for (let i = 0; i < 20; i++) {
        expect(generateReferralCode()).toHaveLength(REFERRAL_CODE_LENGTH);
      }
    });
  });

  describe("character set", () => {
    it("contains only alphanumeric characters (no special chars)", () => {
      expect(generateReferralCode()).toMatch(/^[a-zA-Z0-9]+$/);
    });

    it("no dashes in generated code", () => {
      expect(generateReferralCode()).not.toMatch(/-/);
    });

    it("no underscores in generated code", () => {
      expect(generateReferralCode()).not.toMatch(/_/);
    });

    it("no spaces in generated code", () => {
      expect(generateReferralCode()).not.toMatch(/\s/);
    });

    it("100 codes all match alphanumeric pattern", () => {
      for (let i = 0; i < 100; i++) {
        expect(generateReferralCode()).toMatch(/^[a-zA-Z0-9]+$/);
      }
    });
  });

  describe("uniqueness", () => {
    it("1000 generated codes are all unique", () => {
      const codes = new Set(Array.from({ length: 1000 }, () => generateReferralCode()));
      expect(codes.size).toBe(1000);
    });

    it("two consecutive codes are different", () => {
      const a = generateReferralCode();
      const b = generateReferralCode();
      // Statistically extremely unlikely to be equal with 62^8 possibilities
      expect(a).not.toBe(b);
    });
  });
});

// ── generateApiKey ────────────────────────────────────────────────────────────
describe("generateApiKey", () => {
  describe("prefix", () => {
    it("starts with the given prefix", () => {
      const key = generateApiKey("wl_pk_");
      expect(key.startsWith("wl_pk_")).toBe(true);
    });

    it("starts with the given prefix for a different prefix", () => {
      const key = generateApiKey("wl_sk_");
      expect(key.startsWith("wl_sk_")).toBe(true);
    });

    it("starts with an empty prefix when prefix is empty string", () => {
      const key = generateApiKey("");
      expect(key.startsWith("")).toBe(true); // always true, but verifies no throw
      expect(key).toHaveLength(32);
    });

    it("works with a custom prefix", () => {
      const key = generateApiKey("test_");
      expect(key.startsWith("test_")).toBe(true);
    });
  });

  describe("total length", () => {
    it("total length is prefix.length + 32 for 'wl_pk_'", () => {
      const prefix = "wl_pk_";
      expect(generateApiKey(prefix)).toHaveLength(prefix.length + 32);
    });

    it("total length is prefix.length + 32 for 'wl_sk_'", () => {
      const prefix = "wl_sk_";
      expect(generateApiKey(prefix)).toHaveLength(prefix.length + 32);
    });

    it("total length is 32 when prefix is empty", () => {
      expect(generateApiKey("")).toHaveLength(32);
    });

    it("total length scales correctly with a longer prefix", () => {
      const prefix = "a".repeat(20);
      expect(generateApiKey(prefix)).toHaveLength(52);
    });
  });

  describe("character set", () => {
    it("suffix (nanoid part) contains only URL-safe characters", () => {
      const prefix = "wl_pk_";
      const key = generateApiKey(prefix);
      const suffix = key.slice(prefix.length);
      // nanoid uses A-Za-z0-9_- by default (URL-safe alphabet)
      expect(suffix).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("100 generated keys all have URL-safe characters in suffix", () => {
      const prefix = "wl_sk_";
      for (let i = 0; i < 100; i++) {
        const key = generateApiKey(prefix);
        const suffix = key.slice(prefix.length);
        expect(suffix).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });
  });

  describe("uniqueness", () => {
    it("100 generated keys are all unique", () => {
      const keys = new Set(Array.from({ length: 100 }, () => generateApiKey("wl_pk_")));
      expect(keys.size).toBe(100);
    });

    it("different prefixes produce different keys", () => {
      const key1 = generateApiKey("prefix_a_");
      const key2 = generateApiKey("prefix_b_");
      expect(key1).not.toBe(key2);
    });

    it("two consecutive calls with same prefix return different keys", () => {
      const a = generateApiKey("wl_pk_");
      const b = generateApiKey("wl_pk_");
      expect(a).not.toBe(b);
    });
  });
});
