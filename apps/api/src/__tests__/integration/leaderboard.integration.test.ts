import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createTestApp,
  cleanDatabase,
  closeTestApp,
  createTestProject,
} from "./helpers/setup.js";

describe("Leaderboard Integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await cleanDatabase(app);
  });

  it("returns empty array when no referrals exist", async () => {
    const { apiKey } = await createTestProject(app);

    // Subscribe some users but no referrals
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user1@example.com" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leaderboard",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("returns leaderboard ranked by referral count (highest first)", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    // User A gets 3 referrals
    const aRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "a@example.com", name: "Alice" },
    });
    const aCode = aRes.json().referralCode;

    // User B gets 1 referral
    const bRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "b@example.com", name: "Bob" },
    });
    const bCode = bRes.json().referralCode;

    // A's referrals
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "ref1@example.com", referralCode: aCode },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "ref2@example.com", referralCode: aCode },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "ref3@example.com", referralCode: aCode },
    });

    // B's referral
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "ref4@example.com", referralCode: bCode },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leaderboard",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const leaderboard = res.json();

    expect(leaderboard.length).toBe(2);
    expect(leaderboard[0].rank).toBe(1);
    expect(leaderboard[0].referralCount).toBe(3);
    expect(leaderboard[0].name).toBe("Alice");

    expect(leaderboard[1].rank).toBe(2);
    expect(leaderboard[1].referralCount).toBe(1);
    expect(leaderboard[1].name).toBe("Bob");
  });

  it("uses default limit of 10", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    // Create 12 referrers, each with 1 referral
    for (let i = 1; i <= 12; i++) {
      const refRes = await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: `referrer${i}@example.com`, name: `Referrer ${i}` },
      });
      const code = refRes.json().referralCode;
      await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: `referred${i}@example.com`, referralCode: code },
      });
    }

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leaderboard",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBe(10);
  });

  it("respects custom limit parameter", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    // Create 5 referrers, each with 1 referral
    for (let i = 1; i <= 5; i++) {
      const refRes = await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: `referrer${i}@example.com` },
      });
      const code = refRes.json().referralCode;
      await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: `referred${i}@example.com`, referralCode: code },
      });
    }

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leaderboard?limit=3",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBe(3);
  });

  it("caps limit at 100", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    // Just verify the request succeeds with a >100 limit
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leaderboard?limit=999",
      headers: { "x-api-key": apiKey },
    });

    // Should not error out
    expect(res.statusCode).toBe(200);
    // Result will be <= 100
    expect(res.json().length).toBeLessThanOrEqual(100);
  });

  it("only shows subscribers with referralCount > 0", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    // Subscribe one user with no referrals
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "noref@example.com" },
    });

    // Subscribe one user with a referral
    const refRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "hasref@example.com" },
    });
    const code = refRes.json().referralCode;
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referred@example.com", referralCode: code },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leaderboard",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const leaderboard = res.json();
    // Only 1 entry (the one with a referral)
    expect(leaderboard.length).toBe(1);
    expect(leaderboard[0].referralCount).toBeGreaterThan(0);
  });

  it("returns 401 without API key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leaderboard",
    });

    expect(res.statusCode).toBe(401);
  });

  it("each entry has rank, name, referralCount", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    const refRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referrer@example.com", name: "Referrer" },
    });
    const code = refRes.json().referralCode;
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referred@example.com", referralCode: code },
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/leaderboard",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const entry = res.json()[0];
    expect(entry).toHaveProperty("rank", 1);
    expect(entry).toHaveProperty("name");
    expect(entry).toHaveProperty("referralCount");
    expect(typeof entry.referralCount).toBe("number");
  });
});
