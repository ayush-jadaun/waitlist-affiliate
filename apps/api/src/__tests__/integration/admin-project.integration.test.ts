import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createTestApp,
  cleanDatabase,
  closeTestApp,
  createAdminAndGetToken,
} from "./helpers/setup.js";

const VALID_PROJECT_BODY = {
  name: "My Waitlist",
  mode: "prelaunch",
  requireEmailVerification: false,
  referral: { enabled: true, positionBump: 1 },
  rewards: [],
  deduplication: "email",
  rateLimit: { window: "1m", max: 10 },
};

describe("Admin Project Integration", () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(app);
  });

  beforeEach(async () => {
    await cleanDatabase(app);
    token = await createAdminAndGetToken(app);
  });

  describe("POST /api/v1/admin/project", () => {
    it("creates a project and returns 201 with API key", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: VALID_PROJECT_BODY,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("apiKey");
      expect(body.name).toBe("My Waitlist");
      expect(body.mode).toBe("prelaunch");
    });

    it("API key starts with wl_pk_", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: VALID_PROJECT_BODY,
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().apiKey).toMatch(/^wl_pk_/);
    });

    it("stores hashed API key in database (apiKeyHash != rawKey)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: VALID_PROJECT_BODY,
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      // The returned apiKeyHash should not equal the raw apiKey
      expect(body.apiKeyHash).not.toBe(body.apiKey);
      expect(body.apiKeyHash).toBeTruthy();
    });

    it("returns 400 with invalid config (missing required fields)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Bad Project" }, // missing mode, referral, etc.
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("creates project with mode=prelaunch", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_PROJECT_BODY, mode: "prelaunch" },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().mode).toBe("prelaunch");
    });

    it("creates project with mode=gated", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_PROJECT_BODY, mode: "gated" },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().mode).toBe("gated");
    });

    it("creates project with mode=viral", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_PROJECT_BODY, mode: "viral" },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().mode).toBe("viral");
    });

    it("returns 401 without JWT", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        payload: VALID_PROJECT_BODY,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/admin/project", () => {
    it("lists all projects", async () => {
      // Create two projects
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_PROJECT_BODY, name: "Project A" },
      });
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_PROJECT_BODY, name: "Project B" },
      });

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(2);
    });

    it("returns empty array when no projects exist", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns 401 without JWT", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/project",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("PUT /api/v1/admin/project/:id", () => {
    it("updates project config", async () => {
      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
        payload: VALID_PROJECT_BODY,
      });
      const projectId = createRes.json().id;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/project/${projectId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Updated Name" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("Updated Name");
    });

    it("returns 404 for non-existent project", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/project/${fakeId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Updated" },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: "Project not found" });
    });

    it("returns 401 without JWT", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/project/${fakeId}`,
        payload: { name: "Updated" },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
