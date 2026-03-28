import { describe, it, expect } from "vitest";
import { signPayload, verifySignature } from "../services/webhook.js";

describe("Webhook Signing", () => {
  const secret = "test-secret-key-for-webhooks";
  const payload = JSON.stringify({ type: "subscriber.created", data: { email: "test@example.com" } });

  it("generates a valid HMAC-SHA256 signature", () => {
    const signature = signPayload(payload, secret);
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("verifies a correct signature", () => {
    const signature = signPayload(payload, secret);
    expect(verifySignature(payload, secret, signature)).toBe(true);
  });

  it("rejects an incorrect signature", () => {
    expect(verifySignature(payload, secret, "sha256=invalid0000000000000000000000000000000000000000000000000000000000")).toBe(false);
  });

  it("rejects a different payload", () => {
    const signature = signPayload(payload, secret);
    expect(verifySignature("different", secret, signature)).toBe(false);
  });
});
