import { describe, it, expect } from "vitest";
import { generateReferralCode } from "../lib/referral-code.js";

describe("generateReferralCode", () => {
  it("generates a code of the correct length", () => {
    const code = generateReferralCode();
    expect(code).toHaveLength(8);
  });

  it("generates URL-safe alphanumeric codes", () => {
    const code = generateReferralCode();
    expect(code).toMatch(/^[a-zA-Z0-9]+$/);
  });

  it("generates unique codes", () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateReferralCode()));
    expect(codes.size).toBe(100);
  });
});
