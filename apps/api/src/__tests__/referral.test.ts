import { describe, it, expect } from "vitest";
import { ReferralService } from "../services/referral.js";

describe("ReferralService", () => {
  it("detects self-referral", () => {
    const service = new ReferralService();
    expect(service.isSelfReferral("user@example.com", "user@example.com")).toBe(true);
  });

  it("allows different emails", () => {
    const service = new ReferralService();
    expect(service.isSelfReferral("a@example.com", "b@example.com")).toBe(false);
  });

  it("detects disposable email domains", () => {
    const service = new ReferralService();
    expect(service.isDisposableEmail("test@mailinator.com")).toBe(true);
  });

  it("allows valid email domains", () => {
    const service = new ReferralService();
    expect(service.isDisposableEmail("test@gmail.com")).toBe(false);
  });

  it("is case-insensitive for self-referral check", () => {
    const service = new ReferralService();
    expect(service.isSelfReferral("User@Example.com", "user@example.com")).toBe(true);
  });
});
