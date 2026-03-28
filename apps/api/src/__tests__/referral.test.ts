import { describe, it, expect } from "vitest";
import { ReferralService } from "../services/referral.js";
import { DISPOSABLE_EMAIL_DOMAINS } from "@waitlist/shared";

const service = new ReferralService();

// ── isSelfReferral ────────────────────────────────────────────────────────────
describe("ReferralService.isSelfReferral", () => {
  describe("same email — should be true", () => {
    it("detects exact same email as self-referral", () => {
      expect(service.isSelfReferral("user@example.com", "user@example.com")).toBe(true);
    });

    it("is case-insensitive for the referrer email (uppercase referrer)", () => {
      expect(service.isSelfReferral("User@Example.COM", "user@example.com")).toBe(true);
    });

    it("is case-insensitive for the referred email (uppercase referred)", () => {
      expect(service.isSelfReferral("user@example.com", "USER@EXAMPLE.COM")).toBe(true);
    });

    it("handles fully uppercase both sides", () => {
      expect(service.isSelfReferral("USER@EXAMPLE.COM", "USER@EXAMPLE.COM")).toBe(true);
    });

    it("handles mixed casing on both sides", () => {
      expect(service.isSelfReferral("User@Example.Com", "uSER@eXAMPLE.cOM")).toBe(true);
    });

    it("empty strings treated as equal (self-referral)", () => {
      expect(service.isSelfReferral("", "")).toBe(true);
    });
  });

  describe("different emails — should be false", () => {
    it("allows different emails", () => {
      expect(service.isSelfReferral("a@example.com", "b@example.com")).toBe(false);
    });

    it("same local part but different domain is NOT a self-referral", () => {
      expect(service.isSelfReferral("user@example.com", "user@other.com")).toBe(false);
    });

    it("same domain but different local part is NOT a self-referral", () => {
      expect(service.isSelfReferral("alice@example.com", "bob@example.com")).toBe(false);
    });

    it("whitespace difference makes them different emails", () => {
      expect(service.isSelfReferral(" user@example.com", "user@example.com")).toBe(false);
    });

    it("trailing whitespace on referred email makes them different", () => {
      expect(service.isSelfReferral("user@example.com", "user@example.com ")).toBe(false);
    });
  });
});

// ── isDisposableEmail ─────────────────────────────────────────────────────────
describe("ReferralService.isDisposableEmail", () => {
  describe("known disposable domains — should be true", () => {
    // Test every domain in the constant
    for (const domain of DISPOSABLE_EMAIL_DOMAINS) {
      it(`rejects email with disposable domain: ${domain}`, () => {
        expect(service.isDisposableEmail(`test@${domain}`)).toBe(true);
      });
    }

    it("is case-insensitive for the domain (MAILINATOR.COM)", () => {
      expect(service.isDisposableEmail("test@MAILINATOR.COM")).toBe(true);
    });

    it("is case-insensitive for mixed-case domain (MailInator.Com)", () => {
      expect(service.isDisposableEmail("test@MailInator.Com")).toBe(true);
    });

    it("rejects uppercase variant of tempmail.com", () => {
      expect(service.isDisposableEmail("foo@TEMPMAIL.COM")).toBe(true);
    });

    it("rejects uppercase variant of yopmail.com", () => {
      expect(service.isDisposableEmail("someone@YOPMAIL.COM")).toBe(true);
    });
  });

  describe("legitimate domains — should be false", () => {
    it("allows gmail.com", () => {
      expect(service.isDisposableEmail("user@gmail.com")).toBe(false);
    });

    it("allows outlook.com", () => {
      expect(service.isDisposableEmail("user@outlook.com")).toBe(false);
    });

    it("allows yahoo.com", () => {
      expect(service.isDisposableEmail("user@yahoo.com")).toBe(false);
    });

    it("allows a company domain", () => {
      expect(service.isDisposableEmail("employee@company.com")).toBe(false);
    });

    it("allows protonmail.com", () => {
      expect(service.isDisposableEmail("user@protonmail.com")).toBe(false);
    });

    it("allows hotmail.com", () => {
      expect(service.isDisposableEmail("user@hotmail.com")).toBe(false);
    });
  });

  describe("malformed / edge case inputs — should be false", () => {
    it("returns false for email with no @ symbol", () => {
      // split('@')[1] is undefined → domain falsy → returns false
      expect(service.isDisposableEmail("notanemail")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(service.isDisposableEmail("")).toBe(false);
    });

    it("returns false for just a domain (no @)", () => {
      expect(service.isDisposableEmail("mailinator.com")).toBe(false);
    });

    it("returns false for multiple @ symbols — uses part after first @", () => {
      // split('@') → ['foo', 'bar', 'mailinator.com'] — [1] is 'bar' (not in list)
      expect(service.isDisposableEmail("foo@bar@mailinator.com")).toBe(false);
    });

    it("returns false for subdomain of disposable domain (sub.mailinator.com)", () => {
      // 'sub.mailinator.com' is NOT in the exact-match list
      expect(service.isDisposableEmail("test@sub.mailinator.com")).toBe(false);
    });

    it("returns false for an @-only string", () => {
      // split('@') → ['', ''] → domain = '' → falsy → false
      expect(service.isDisposableEmail("@")).toBe(false);
    });

    it("returns false when domain part is empty after @", () => {
      expect(service.isDisposableEmail("user@")).toBe(false);
    });
  });
});
