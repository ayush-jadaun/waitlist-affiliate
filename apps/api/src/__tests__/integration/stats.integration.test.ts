import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createTestApp,
  cleanDatabase,
  closeTestApp,
  createTestProject,
} from "./helpers/setup.js";

describe("Stats Integration", () => {
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

  it("returns 0 signups and 0 referrals for empty project", async () => {
    const { apiKey } = await createTestProject(app);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stats",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totalSignups).toBe(0);
    expect(body.referralsMade).toBe(0);
    expect(body.spotsRemaining).toBeNull();
  });

  it("reflects correct signup count after signups", async () => {
    const { apiKey } = await createTestProject(app);

    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user1@example.com" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user2@example.com" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user3@example.com" },
    });

    // Flush cache to get fresh data
    await app.redis.flushdb();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stats",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().totalSignups).toBe(3);
  });

  it("reflects correct referral count after referrals", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    const refRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referrer@example.com" },
    });
    const referralCode = refRes.json().referralCode;

    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referred1@example.com", referralCode },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referred2@example.com", referralCode },
    });

    // Flush cache
    await app.redis.flushdb();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stats",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().referralsMade).toBe(2);
  });

  it("spotsRemaining is calculated when maxSubscribers is set", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      maxSubscribers: 10,
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user1@example.com" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user2@example.com" },
    });

    // Flush cache
    await app.redis.flushdb();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stats",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().spotsRemaining).toBe(8);
  });

  it("spotsRemaining is null when no maxSubscribers set", async () => {
    const { apiKey } = await createTestProject(app, { mode: "prelaunch" });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stats",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().spotsRemaining).toBeNull();
  });

  it("spotsRemaining never goes below 0", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      maxSubscribers: 2,
    });

    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user1@example.com" },
    });
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user2@example.com" },
    });

    // Flush cache
    await app.redis.flushdb();

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stats",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().spotsRemaining).toBe(0);
  });

  it("returns 401 without API key", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stats",
    });

    expect(res.statusCode).toBe(401);
  });

  it("response has expected fields", async () => {
    const { apiKey } = await createTestProject(app);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/stats",
      headers: { "x-api-key": apiKey },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("totalSignups");
    expect(body).toHaveProperty("spotsRemaining");
    expect(body).toHaveProperty("referralsMade");
  });
});
