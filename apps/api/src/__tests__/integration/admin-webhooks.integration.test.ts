import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createTestApp,
  cleanDatabase,
  closeTestApp,
  createTestProject,
  createAdminAndGetToken,
} from "./helpers/setup.js";

const VALID_WEBHOOK_PAYLOAD = {
  url: "https://example.com/webhook",
  secret: "a-secret-at-least-16-chars",
  events: ["subscriber.created"],
};

describe("Admin Webhooks Integration", () => {
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

  describe("GET /api/v1/admin/webhooks", () => {
    it("returns empty array when no webhook endpoints", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/webhooks?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns webhook endpoints for the project", async () => {
      const { project } = await createTestProject(app);

      await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_WEBHOOK_PAYLOAD, projectId: project.id },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/webhooks?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect(res.json()[0].url).toBe("https://example.com/webhook");
    });

    it("returns 401 without JWT", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/webhooks?projectId=${project.id}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/admin/webhooks", () => {
    it("creates a webhook endpoint (201)", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_WEBHOOK_PAYLOAD, projectId: project.id },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty("id");
      expect(body.url).toBe("https://example.com/webhook");
      expect(body.active).toBe(true);
    });

    it("returns 400 for invalid URL", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ...VALID_WEBHOOK_PAYLOAD,
          projectId: project.id,
          url: "not-a-valid-url",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("returns 400 when secret is too short (< 16 chars)", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ...VALID_WEBHOOK_PAYLOAD,
          projectId: project.id,
          secret: "tooshort",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("returns 400 when secret is too long (> 128 chars)", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ...VALID_WEBHOOK_PAYLOAD,
          projectId: project.id,
          secret: "a".repeat(129),
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("returns 400 when events array is empty", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ...VALID_WEBHOOK_PAYLOAD,
          projectId: project.id,
          events: [],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("returns 400 for invalid event type", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          ...VALID_WEBHOOK_PAYLOAD,
          projectId: project.id,
          events: ["invalid.event"],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 401 without JWT", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        payload: { ...VALID_WEBHOOK_PAYLOAD, projectId: project.id },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/v1/admin/webhooks/:id", () => {
    it("deletes a webhook endpoint (204)", async () => {
      const { project } = await createTestProject(app);

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_WEBHOOK_PAYLOAD, projectId: project.id },
      });
      const endpointId = createRes.json().id;

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/webhooks/${endpointId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify it's gone
      const getRes = await app.inject({
        method: "GET",
        url: `/api/v1/admin/webhooks?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.json()).toHaveLength(0);
    });

    it("returns 404 for non-existent webhook endpoint", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/webhooks/${fakeId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 401 without JWT", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/webhooks/00000000-0000-0000-0000-000000000000",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("GET /api/v1/admin/webhooks/:id/deliveries", () => {
    it("returns empty array when no deliveries", async () => {
      const { project } = await createTestProject(app);

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/admin/webhooks",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_WEBHOOK_PAYLOAD, projectId: project.id },
      });
      const endpointId = createRes.json().id;

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/webhooks/${endpointId}/deliveries`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns 401 without JWT", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/webhooks/00000000-0000-0000-0000-000000000000/deliveries",
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
