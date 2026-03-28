import { describe, it, expect, vi, beforeEach } from "vitest";
import { WaitlistClient } from "../client.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeOkResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  };
}

function makeErrorResponse(status: number, body: unknown) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve(body),
  };
}

function makeNetworkError() {
  return Promise.reject(new TypeError("fetch failed: network error"));
}

const subscribeResponse = {
  id: "sub-1",
  email: "test@example.com",
  position: 1,
  referralCode: "abc12345",
  status: "waiting",
  totalSignups: 1,
};

const statusResponse = {
  position: 5,
  referralCount: 3,
  referralCode: "abc12345",
  rewards: ["early_access"],
  status: "waiting",
};

// ── Constructor ───────────────────────────────────────────────────────────────
describe("WaitlistClient constructor", () => {
  it("strips a trailing slash from baseUrl", () => {
    const client = new WaitlistClient({ apiKey: "key", baseUrl: "http://localhost:3400/" });
    // Verify the internal baseUrl is stripped by observing the request URL
    mockFetch.mockResolvedValueOnce(makeOkResponse(subscribeResponse));
    client.subscribe({ email: "u@e.com" });
    const [calledUrl] = mockFetch.mock.calls[0] as [string, unknown];
    expect(calledUrl).toBe("http://localhost:3400/api/v1/subscribe");
    mockFetch.mockReset();
  });

  it("strips multiple trailing slashes (only one slash)", () => {
    const client = new WaitlistClient({ apiKey: "key", baseUrl: "http://localhost:3400/" });
    mockFetch.mockResolvedValueOnce(makeOkResponse(subscribeResponse));
    client.subscribe({ email: "u@e.com" });
    const [calledUrl] = mockFetch.mock.calls[0] as [string, unknown];
    expect(calledUrl).not.toMatch(/\/\/api/);
    mockFetch.mockReset();
  });

  it("works without trailing slash (no double stripping)", () => {
    const client = new WaitlistClient({ apiKey: "key", baseUrl: "http://localhost:3400" });
    mockFetch.mockResolvedValueOnce(makeOkResponse(subscribeResponse));
    client.subscribe({ email: "u@e.com" });
    const [calledUrl] = mockFetch.mock.calls[0] as [string, unknown];
    expect(calledUrl).toBe("http://localhost:3400/api/v1/subscribe");
    mockFetch.mockReset();
  });

  it("stores the API key and sends it with requests", async () => {
    const client = new WaitlistClient({ apiKey: "wl_pk_test123", baseUrl: "http://localhost:3400" });
    mockFetch.mockResolvedValueOnce(makeOkResponse(subscribeResponse));
    await client.subscribe({ email: "u@e.com" });
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)?.["X-API-Key"]).toBe("wl_pk_test123");
  });
});

// ── subscribe ─────────────────────────────────────────────────────────────────
describe("WaitlistClient.subscribe", () => {
  let client: WaitlistClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new WaitlistClient({ apiKey: "wl_pk_test123", baseUrl: "http://localhost:3400" });
  });

  it("sends POST to /api/v1/subscribe", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(subscribeResponse));
    await client.subscribe({ email: "test@example.com" });
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3400/api/v1/subscribe");
    expect(options.method).toBe("POST");
  });

  it("sends Content-Type: application/json header", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(subscribeResponse));
    await client.subscribe({ email: "test@example.com" });
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)?.["Content-Type"]).toBe("application/json");
  });

  it("sends X-API-Key header", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(subscribeResponse));
    await client.subscribe({ email: "test@example.com" });
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((options.headers as Record<string, string>)?.["X-API-Key"]).toBe("wl_pk_test123");
  });

  it("serialises the input as JSON body", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(subscribeResponse));
    const input = { email: "test@example.com", name: "Alice", referralCode: "abc12345" };
    await client.subscribe(input);
    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual(input);
  });

  it("returns the parsed response from the API", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(subscribeResponse));
    const result = await client.subscribe({ email: "test@example.com" });
    expect(result).toEqual(subscribeResponse);
    expect(result.referralCode).toBe("abc12345");
  });

  it("throws with the error message on 400 response", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(400, { error: "Invalid email" }));
    await expect(client.subscribe({ email: "bad" })).rejects.toThrow("Invalid email");
  });

  it("throws with the error message on 401 response", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401, { error: "Invalid API key" }));
    await expect(client.subscribe({ email: "test@example.com" })).rejects.toThrow("Invalid API key");
  });

  it("throws with the error message on 500 response", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, { error: "Internal server error" }));
    await expect(client.subscribe({ email: "test@example.com" })).rejects.toThrow("Internal server error");
  });

  it("falls back to 'HTTP <status>' when error response has no error field", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(503, {}));
    await expect(client.subscribe({ email: "test@example.com" })).rejects.toThrow("HTTP 503");
  });

  it("throws on network failure", async () => {
    mockFetch.mockImplementationOnce(() => makeNetworkError());
    await expect(client.subscribe({ email: "test@example.com" })).rejects.toThrow();
  });

  it("throws when JSON parsing of error body fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    });
    await expect(client.subscribe({ email: "test@example.com" })).rejects.toThrow();
  });
});

// ── getStatus ─────────────────────────────────────────────────────────────────
describe("WaitlistClient.getStatus", () => {
  let client: WaitlistClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new WaitlistClient({ apiKey: "wl_pk_test123", baseUrl: "http://localhost:3400" });
  });

  it("sends GET to the correct URL with encoded email", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(statusResponse));
    await client.getStatus("test@example.com");
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3400/api/v1/subscribe/test%40example.com/status");
    expect(options.method).toBeUndefined(); // default GET
  });

  it("URL-encodes special characters in email", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(statusResponse));
    await client.getStatus("user+tag@example.com");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain(encodeURIComponent("user+tag@example.com"));
  });

  it("URL-encodes email with spaces", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(statusResponse));
    await client.getStatus("user name@example.com");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain(encodeURIComponent("user name@example.com"));
  });

  it("returns the parsed status response", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(statusResponse));
    const result = await client.getStatus("test@example.com");
    expect(result).toEqual(statusResponse);
    expect(result.referralCount).toBe(3);
    expect(result.rewards).toContain("early_access");
  });

  it("throws on 404 response", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(404, { error: "Subscriber not found" }));
    await expect(client.getStatus("unknown@example.com")).rejects.toThrow("Subscriber not found");
  });

  it("throws on network failure", async () => {
    mockFetch.mockImplementationOnce(() => makeNetworkError());
    await expect(client.getStatus("test@example.com")).rejects.toThrow();
  });
});

// ── getLeaderboard ────────────────────────────────────────────────────────────
describe("WaitlistClient.getLeaderboard", () => {
  let client: WaitlistClient;
  const leaderboardResponse = [
    { rank: 1, name: "Alice", referralCount: 10 },
    { rank: 2, name: "Bob", referralCount: 7 },
  ];

  beforeEach(() => {
    mockFetch.mockReset();
    client = new WaitlistClient({ apiKey: "wl_pk_test123", baseUrl: "http://localhost:3400" });
  });

  it("sends GET to /api/v1/leaderboard with default limit=10", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(leaderboardResponse));
    await client.getLeaderboard();
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("http://localhost:3400/api/v1/leaderboard?limit=10");
  });

  it("sends GET with a custom limit", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(leaderboardResponse));
    await client.getLeaderboard(25);
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("http://localhost:3400/api/v1/leaderboard?limit=25");
  });

  it("returns the array of leaderboard entries", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(leaderboardResponse));
    const result = await client.getLeaderboard();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]?.rank).toBe(1);
  });

  it("returns an empty array when no entries", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse([]));
    const result = await client.getLeaderboard();
    expect(result).toEqual([]);
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401, { error: "Invalid API key" }));
    await expect(client.getLeaderboard()).rejects.toThrow("Invalid API key");
  });

  it("throws on network failure", async () => {
    mockFetch.mockImplementationOnce(() => makeNetworkError());
    await expect(client.getLeaderboard()).rejects.toThrow();
  });
});

// ── getStats ──────────────────────────────────────────────────────────────────
describe("WaitlistClient.getStats", () => {
  let client: WaitlistClient;
  const statsResponse = { totalSignups: 500, spotsRemaining: 200, referralsMade: 150 };

  beforeEach(() => {
    mockFetch.mockReset();
    client = new WaitlistClient({ apiKey: "wl_pk_test123", baseUrl: "http://localhost:3400" });
  });

  it("sends GET to /api/v1/stats", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(statsResponse));
    await client.getStats();
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toBe("http://localhost:3400/api/v1/stats");
  });

  it("returns the stats object", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse(statsResponse));
    const result = await client.getStats();
    expect(result).toEqual(statsResponse);
    expect(result.totalSignups).toBe(500);
  });

  it("handles spotsRemaining = null", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ ...statsResponse, spotsRemaining: null }));
    const result = await client.getStats();
    expect(result.spotsRemaining).toBeNull();
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, { error: "Internal server error" }));
    await expect(client.getStats()).rejects.toThrow("Internal server error");
  });

  it("throws on network failure", async () => {
    mockFetch.mockImplementationOnce(() => makeNetworkError());
    await expect(client.getStats()).rejects.toThrow();
  });
});

// ── Error handling cross-cutting ──────────────────────────────────────────────
describe("WaitlistClient error handling", () => {
  let client: WaitlistClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new WaitlistClient({ apiKey: "wl_pk_test123", baseUrl: "http://localhost:3400" });
  });

  it("400 response throws with the error message from body", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(400, { error: "Bad request" }));
    await expect(client.getStats()).rejects.toThrow("Bad request");
  });

  it("401 response throws 'Invalid API key'", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(401, { error: "Invalid API key" }));
    await expect(client.getStats()).rejects.toThrow("Invalid API key");
  });

  it("500 response throws with error message from body", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(500, { error: "Server exploded" }));
    await expect(client.getStats()).rejects.toThrow("Server exploded");
  });

  it("error response body without 'error' field uses HTTP status fallback", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(422, { message: "Validation failed" }));
    await expect(client.getStats()).rejects.toThrow("HTTP 422");
  });

  it("network failure throws a TypeError", async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new TypeError("Network unreachable")));
    await expect(client.getStats()).rejects.toThrow(TypeError);
  });
});
