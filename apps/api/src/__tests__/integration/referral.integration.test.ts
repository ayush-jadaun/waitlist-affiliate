import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  createTestApp,
  cleanDatabase,
  closeTestApp,
  createTestProject,
} from "./helpers/setup.js";
import { referrals } from "../../db/schema.js";

describe("Referral System Integration", () => {
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

  it("creates referral record when subscriber uses ref code", async () => {
    const { apiKey, project } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    // Referrer subscribes
    const referrerRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referrer@example.com" },
    });
    const referralCode = referrerRes.json().referralCode;

    // Referred user subscribes
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referred@example.com", referralCode },
    });

    // Verify referral record in DB
    const dbReferrals = await app.db
      .select()
      .from(referrals)
      .where(eq(referrals.projectId, project.id));

    expect(dbReferrals).toHaveLength(1);
    expect(dbReferrals[0]!.referrerId).toBeTruthy();
    expect(dbReferrals[0]!.referredId).toBeTruthy();
  });

  it("creates referral chain: A→B, B→C", async () => {
    const { apiKey, project } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    // A subscribes
    const aRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "a@example.com" },
    });
    const aCode = aRes.json().referralCode;

    // B subscribes using A's code
    const bRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "b@example.com", referralCode: aCode },
    });
    const bCode = bRes.json().referralCode;

    // C subscribes using B's code
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "c@example.com", referralCode: bCode },
    });

    // Both referral records should exist
    const dbReferrals = await app.db
      .select()
      .from(referrals)
      .where(eq(referrals.projectId, project.id));

    expect(dbReferrals).toHaveLength(2);
  });

  it("prevents self-referral (same email)", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    // User subscribes, gets referral code
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user@example.com" },
    });
    const referralCode = res.json().referralCode;

    // User tries to re-subscribe with their own code (duplicate = return existing)
    const resubRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "user@example.com", referralCode },
    });

    // Returns existing subscriber (200), no new referral
    expect(resubRes.statusCode).toBe(200);

    const statusRes = await app.inject({
      method: "GET",
      url: "/api/v1/subscribe/user@example.com/status",
      headers: { "x-api-key": apiKey },
    });
    // No self-referral (the existing subscriber is returned, no new referral created)
    expect(statusRes.json().referralCount).toBe(0);
  });

  it("referral count increases on referrer's status", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    const referrerRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referrer@example.com" },
    });
    const referralCode = referrerRes.json().referralCode;

    // Before any referrals
    let statusRes = await app.inject({
      method: "GET",
      url: "/api/v1/subscribe/referrer@example.com/status",
      headers: { "x-api-key": apiKey },
    });
    expect(statusRes.json().referralCount).toBe(0);

    // After one referral
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referred1@example.com", referralCode },
    });

    statusRes = await app.inject({
      method: "GET",
      url: "/api/v1/subscribe/referrer@example.com/status",
      headers: { "x-api-key": apiKey },
    });
    expect(statusRes.json().referralCount).toBe(1);
  });

  it("supports multiple referrals for same referrer", async () => {
    const { apiKey } = await createTestProject(app, {
      mode: "prelaunch",
      referral: { enabled: true, positionBump: 1 },
    });

    const referrerRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referrer@example.com" },
    });
    const referralCode = referrerRes.json().referralCode;

    for (let i = 1; i <= 5; i++) {
      await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: `referred${i}@example.com`, referralCode },
      });
    }

    const statusRes = await app.inject({
      method: "GET",
      url: "/api/v1/subscribe/referrer@example.com/status",
      headers: { "x-api-key": apiKey },
    });
    expect(statusRes.json().referralCount).toBe(5);
  });

  it("referral from different project is ignored", async () => {
    const { apiKey: key1 } = await createTestProject(app, {
      mode: "prelaunch",
      name: "Project 1",
      referral: { enabled: true, positionBump: 1 },
    });
    const { apiKey: key2, project: project2 } = await createTestProject(app, {
      mode: "prelaunch",
      name: "Project 2",
      referral: { enabled: true, positionBump: 1 },
    });

    // Get referral code from project 1
    const p1RefRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": key1 },
      payload: { email: "referrer@example.com" },
    });
    const codeFromProject1 = p1RefRes.json().referralCode;

    // Try to subscribe in project 2 with code from project 1
    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": key2 },
      payload: { email: "user@example.com", referralCode: codeFromProject1 },
    });

    // No referrals in project 2
    const dbReferrals = await app.db
      .select()
      .from(referrals)
      .where(eq(referrals.projectId, project2.id));

    expect(dbReferrals).toHaveLength(0);
  });

  it("referral verified=true when emailVerification disabled", async () => {
    const { apiKey, project } = await createTestProject(app, {
      mode: "prelaunch",
      requireEmailVerification: false,
      referral: { enabled: true, positionBump: 1 },
    });

    const referrerRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referrer@example.com" },
    });
    const referralCode = referrerRes.json().referralCode;

    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referred@example.com", referralCode },
    });

    const dbReferrals = await app.db
      .select()
      .from(referrals)
      .where(eq(referrals.projectId, project.id));

    expect(dbReferrals[0]!.verified).toBe(true);
  });

  it("referral verified=false when emailVerification enabled", async () => {
    const { apiKey, project } = await createTestProject(app, {
      mode: "prelaunch",
      requireEmailVerification: true,
      referral: { enabled: true, positionBump: 1 },
    });

    const referrerRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referrer@example.com" },
    });
    const referralCode = referrerRes.json().referralCode;

    await app.inject({
      method: "POST",
      url: "/api/v1/subscribe",
      headers: { "x-api-key": apiKey },
      payload: { email: "referred@example.com", referralCode },
    });

    const dbReferrals = await app.db
      .select()
      .from(referrals)
      .where(eq(referrals.projectId, project.id));

    expect(dbReferrals[0]!.verified).toBe(false);
  });
});
