import { describe, it, expect, vi, beforeEach } from "vitest";
import { WaitlistClient } from "../client.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("WaitlistClient", () => {
  let client: WaitlistClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new WaitlistClient({ apiKey: "wl_pk_test123", baseUrl: "http://localhost:3400" });
  });

  it("sends subscribe request with correct headers", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        id: "sub-1", email: "test@example.com", position: 1,
        referralCode: "abc12345", status: "waiting", totalSignups: 1,
      }),
    });

    const result = await client.subscribe({ email: "test@example.com" });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3400/api/v1/subscribe",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-API-Key": "wl_pk_test123",
        }),
      })
    );
    expect(result.referralCode).toBe("abc12345");
  });

  it("sends status request", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        position: 5, referralCount: 3, referralCode: "abc12345",
        rewards: ["early_access"], status: "waiting",
      }),
    });

    const status = await client.getStatus("test@example.com");
    expect(status.referralCount).toBe(3);
    expect(status.rewards).toContain("early_access");
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false, status: 401,
      json: () => Promise.resolve({ error: "Invalid API key" }),
    });

    await expect(client.subscribe({ email: "test@example.com" })).rejects.toThrow("Invalid API key");
  });
});
