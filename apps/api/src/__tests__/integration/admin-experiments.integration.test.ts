import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createTestApp,
  cleanDatabase,
  closeTestApp,
  createTestProject,
  createAdminAndGetToken,
} from "./helpers/setup.js";

const VALID_EXPERIMENT = {
  name: "Button Color Test",
  variants: [
    { name: "control", weight: 50 },
    { name: "variant_a", weight: 50 },
  ],
};

describe("Admin Experiments Integration", () => {
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

  describe("GET /api/v1/admin/experiments", () => {
    it("returns empty array when no experiments", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/experiments?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns experiments for the project", async () => {
      const { project } = await createTestProject(app);

      await app.inject({
        method: "POST",
        url: "/api/v1/admin/experiments",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_EXPERIMENT, projectId: project.id },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/experiments?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect(res.json()[0].name).toBe("Button Color Test");
    });

    it("returns 401 without JWT", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/experiments?projectId=${project.id}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/admin/experiments", () => {
    it("creates an experiment (201)", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/experiments",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_EXPERIMENT, projectId: project.id },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty("id");
      expect(body.name).toBe("Button Color Test");
      expect(body.active).toBe(true);
      expect(Array.isArray(body.variants)).toBe(true);
      expect(body.variants).toHaveLength(2);
    });

    it("creates experiment with up to 5 variants", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/experiments",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          projectId: project.id,
          name: "Five Variant Test",
          variants: [
            { name: "v1", weight: 20 },
            { name: "v2", weight: 20 },
            { name: "v3", weight: 20 },
            { name: "v4", weight: 20 },
            { name: "v5", weight: 20 },
          ],
        },
      });

      expect(res.statusCode).toBe(201);
      expect(res.json().variants).toHaveLength(5);
    });

    it("returns 400 with fewer than 2 variants", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/experiments",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          projectId: project.id,
          name: "Bad Experiment",
          variants: [{ name: "only_one", weight: 100 }],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("returns 400 with more than 5 variants", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/experiments",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          projectId: project.id,
          name: "Too Many Variants",
          variants: [
            { name: "v1", weight: 16 },
            { name: "v2", weight: 16 },
            { name: "v3", weight: 17 },
            { name: "v4", weight: 17 },
            { name: "v5", weight: 17 },
            { name: "v6", weight: 17 },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("returns 401 without JWT", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/experiments",
        payload: { ...VALID_EXPERIMENT, projectId: project.id },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("PATCH /api/v1/admin/experiments/:id (toggle active)", () => {
    it("toggles experiment from active to inactive", async () => {
      const { project } = await createTestProject(app);

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/admin/experiments",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_EXPERIMENT, projectId: project.id },
      });
      const experimentId = createRes.json().id;
      expect(createRes.json().active).toBe(true);

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/experiments/${experimentId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().active).toBe(false);
    });

    it("toggles experiment from inactive back to active", async () => {
      const { project } = await createTestProject(app);

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/admin/experiments",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_EXPERIMENT, projectId: project.id },
      });
      const experimentId = createRes.json().id;

      // Toggle off
      await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/experiments/${experimentId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      // Toggle back on
      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/experiments/${experimentId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().active).toBe(true);
    });

    it("returns 404 for non-existent experiment", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      const res = await app.inject({
        method: "PATCH",
        url: `/api/v1/admin/experiments/${fakeId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 401 without JWT", async () => {
      const res = await app.inject({
        method: "PATCH",
        url: "/api/v1/admin/experiments/00000000-0000-0000-0000-000000000000",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("DELETE /api/v1/admin/experiments/:id", () => {
    it("deletes an experiment (204)", async () => {
      const { project } = await createTestProject(app);

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/admin/experiments",
        headers: { authorization: `Bearer ${token}` },
        payload: { ...VALID_EXPERIMENT, projectId: project.id },
      });
      const experimentId = createRes.json().id;

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/experiments/${experimentId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify it's gone
      const getRes = await app.inject({
        method: "GET",
        url: `/api/v1/admin/experiments?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.json()).toHaveLength(0);
    });

    it("returns 404 for non-existent experiment", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/experiments/${fakeId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 401 without JWT", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/experiments/00000000-0000-0000-0000-000000000000",
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
