import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  createTestApp,
  cleanDatabase,
  closeTestApp,
  createTestProject,
  createAdminAndGetToken,
} from "./helpers/setup.js";

describe("Admin Rewards Integration", () => {
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

  describe("GET /api/v1/admin/rewards", () => {
    it("returns empty array when no reward tiers", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/rewards?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual([]);
    });

    it("returns reward tiers for the project", async () => {
      const { project } = await createTestProject(app);

      await app.inject({
        method: "POST",
        url: "/api/v1/admin/rewards",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          projectId: project.id,
          name: "Early Access",
          threshold: 3,
          rewardType: "flag",
          rewardValue: "early_access",
          sortOrder: 0,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/rewards?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveLength(1);
      expect(res.json()[0].name).toBe("Early Access");
    });

    it("returns 401 without JWT", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "GET",
        url: `/api/v1/admin/rewards?projectId=${project.id}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/admin/rewards", () => {
    it("creates a reward tier (201)", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/rewards",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          projectId: project.id,
          name: "VIP Access",
          threshold: 5,
          rewardType: "code",
          rewardValue: "VIP_CODE_123",
          sortOrder: 1,
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty("id");
      expect(body.name).toBe("VIP Access");
      expect(body.threshold).toBe(5);
      expect(body.rewardType).toBe("code");
    });

    it("returns 400 when threshold is 0 or missing", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/rewards",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          projectId: project.id,
          name: "Bad Reward",
          threshold: 0,
          rewardType: "flag",
          rewardValue: "something",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("returns 400 for invalid rewardType", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/rewards",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          projectId: project.id,
          name: "Bad Reward",
          threshold: 3,
          rewardType: "invalid_type",
          rewardValue: "something",
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("supports all valid rewardType values", async () => {
      const { project } = await createTestProject(app);

      for (const rewardType of ["flag", "code", "custom"]) {
        const res = await app.inject({
          method: "POST",
          url: "/api/v1/admin/rewards",
          headers: { authorization: `Bearer ${token}` },
          payload: {
            projectId: project.id,
            name: `Reward ${rewardType}`,
            threshold: 1,
            rewardType,
            rewardValue: "some_value",
          },
        });

        expect(res.statusCode).toBe(201);
        expect(res.json().rewardType).toBe(rewardType);
      }
    });

    it("returns 401 without JWT", async () => {
      const { project } = await createTestProject(app);

      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/rewards",
        payload: {
          projectId: project.id,
          name: "Test",
          threshold: 3,
          rewardType: "flag",
          rewardValue: "val",
        },
      });

      expect(res.statusCode).toBe(401);
    });
  });

  describe("PUT /api/v1/admin/rewards/:id", () => {
    it("updates a reward tier", async () => {
      const { project } = await createTestProject(app);

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/admin/rewards",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          projectId: project.id,
          name: "Original",
          threshold: 3,
          rewardType: "flag",
          rewardValue: "original_val",
        },
      });
      const tierId = createRes.json().id;

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/rewards/${tierId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Updated Name", threshold: 5 },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().name).toBe("Updated Name");
      expect(res.json().threshold).toBe(5);
    });

    it("returns 404 for non-existent reward tier", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      const res = await app.inject({
        method: "PUT",
        url: `/api/v1/admin/rewards/${fakeId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: "Updated" },
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/v1/admin/rewards/:id", () => {
    it("deletes a reward tier (204)", async () => {
      const { project } = await createTestProject(app);

      const createRes = await app.inject({
        method: "POST",
        url: "/api/v1/admin/rewards",
        headers: { authorization: `Bearer ${token}` },
        payload: {
          projectId: project.id,
          name: "To Delete",
          threshold: 3,
          rewardType: "flag",
          rewardValue: "val",
        },
      });
      const tierId = createRes.json().id;

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/rewards/${tierId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify it's gone
      const getRes = await app.inject({
        method: "GET",
        url: `/api/v1/admin/rewards?projectId=${project.id}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(getRes.json()).toHaveLength(0);
    });

    it("returns 404 for non-existent reward tier", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";

      const res = await app.inject({
        method: "DELETE",
        url: `/api/v1/admin/rewards/${fakeId}`,
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 401 without JWT", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: "/api/v1/admin/rewards/00000000-0000-0000-0000-000000000000",
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
