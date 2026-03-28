import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createTestApp,
  cleanDatabase,
  closeTestApp,
  createTestProject,
  createAdminAndGetToken,
} from "./helpers/setup.js";

describe("Admin Subscribers Integration", () => {
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

  async function seedSubscribers(
    apiKey: string,
    projectId: string,
    count: number
  ) {
    for (let i = 1; i <= count; i++) {
      await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: `user${i}@example.com` },
      });
    }
  }

  describe("GET /api/v1/admin/subscribers", () => {
    it("returns paginated subscribers", async () => {
      const { apiKey, project } = await createTestProject(app);
      await seedSubscribers(apiKey, project.id, 5);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/subscribers?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("data");
      expect(body).toHaveProperty("pagination");
      expect(body.data).toHaveLength(5);
      expect(body.pagination.total).toBe(5);
    });

    it("supports pagination", async () => {
      const { apiKey, project } = await createTestProject(app);
      await seedSubscribers(apiKey, project.id, 25);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/subscribers?projectId=${project.id}&page=2&limit=10`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(10);
      expect(body.pagination.page).toBe(2);
      expect(body.pagination.limit).toBe(10);
      expect(body.pagination.total).toBe(25);
      expect(body.pagination.pages).toBe(3);
    });

    it("filters by search (email match)", async () => {
      const { apiKey, project } = await createTestProject(app);
      await seedSubscribers(apiKey, project.id, 3);
      // Add a unique email
      await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: "special@domain.com" },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/subscribers?projectId=${project.id}&search=special`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe("special@domain.com");
    });

    it("filters by status", async () => {
      const { apiKey, project } = await createTestProject(app, { mode: "gated" });
      await seedSubscribers(apiKey, project.id, 3);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/subscribers?projectId=${project.id}&status=pending`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.data.length).toBeGreaterThan(0);
      body.data.forEach((s: any) => expect(s.status).toBe("pending"));
    });

    it("returns 401 without JWT", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/subscribers?projectId=${project.id}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 400 without projectId", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/subscribers",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  describe("PATCH /api/v1/admin/subscribers/:id", () => {
    it("approves a subscriber", async () => {
      const { apiKey, project } = await createTestProject(app, { mode: "gated" });
      const subRes = await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: "user@example.com" },
      });
      const subscriberId = subRes.json().id;

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/subscribers/${subscriberId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "approved" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("approved");
    });

    it("rejects a subscriber", async () => {
      const { apiKey } = await createTestProject(app, { mode: "gated" });
      const subRes = await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: "user@example.com" },
      });
      const subscriberId = subRes.json().id;

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/subscribers/${subscriberId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "rejected" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("rejected");
    });

    it("bans a subscriber", async () => {
      const { apiKey } = await createTestProject(app);
      const subRes = await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: "user@example.com" },
      });
      const subscriberId = subRes.json().id;

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/subscribers/${subscriberId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "banned" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe("banned");
    });

    it("returns 404 for non-existent subscriber", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/subscribers/${fakeId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "approved" },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json()).toMatchObject({ error: "Subscriber not found" });
    });

    it("returns 400 for invalid status", async () => {
      const { apiKey } = await createTestProject(app);
      const subRes = await app.inject({
        method: "POST",
        url: "/api/v1/subscribe",
        headers: { "x-api-key": apiKey },
        payload: { email: "user@example.com" },
      });
      const subscriberId = subRes.json().id;

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/subscribers/${subscriberId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { status: "invalid_status" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("returns 401 without JWT", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/subscribers/${fakeId}`,
        payload: { status: "approved" },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/admin/subscribers/bulk", () => {
    it("bulk approves subscribers", async () => {
      const { apiKey, project } = await createTestProject(app, { mode: "gated" });

      const ids: string[] = [];
      for (let i = 1; i <= 3; i++) {
        const subRes = await app.inject({
          method: "POST",
          url: "/api/v1/subscribe",
          headers: { "x-api-key": apiKey },
          payload: { email: `user${i}@example.com` },
        });
        ids.push(subRes.json().id);
      }

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/subscribers/bulk",
        headers: { authorization: `Bearer ${token}` },
        payload: { ids, action: "approve" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ updated: 3 });

      // Verify in DB via list endpoint
      const listRes = await app.inject({
        method: "GET",
        url: `/api/v1/admin/subscribers?projectId=${project.id}&status=approved`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listRes.json().data).toHaveLength(3);
    });

    it("bulk rejects subscribers", async () => {
      const { apiKey } = await createTestProject(app, { mode: "gated" });

      const ids: string[] = [];
      for (let i = 1; i <= 2; i++) {
        const subRes = await app.inject({
          method: "POST",
          url: "/api/v1/subscribe",
          headers: { "x-api-key": apiKey },
          payload: { email: `user${i}@example.com` },
        });
        ids.push(subRes.json().id);
      }

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/subscribers/bulk",
        headers: { authorization: `Bearer ${token}` },
        payload: { ids, action: "reject" },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toMatchObject({ updated: 2 });
    });

    it("returns 401 without JWT", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/subscribers/bulk",
        payload: { ids: ["00000000-0000-0000-0000-000000000000"], action: "approve" },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
