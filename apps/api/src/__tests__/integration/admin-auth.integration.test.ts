import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { FastifyInstance } from "fastify";
import { createTestApp, cleanDatabase, closeTestApp, TEST_JWT_SECRET } from "./helpers/setup.js";

describe("Admin Auth Integration", () => {
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

  describe("POST /api/v1/admin/auth/setup", () => {
    it("creates first admin and returns token (201)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/setup",
        payload: { email: "admin@example.com", password: "password123" },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body).toHaveProperty("token");
      expect(typeof body.token).toBe("string");
      expect(body.token.length).toBeGreaterThan(0);
    });

    it("fails on second setup attempt (409)", async () => {
      // First admin
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/setup",
        payload: { email: "admin@example.com", password: "password123" },
      });

      // Second attempt
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/setup",
        payload: { email: "admin2@example.com", password: "password456" },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json()).toMatchObject({ error: "Admin already exists" });
    });

    it("returns 400 for invalid email format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/setup",
        payload: { email: "not-an-email", password: "password123" },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body).toHaveProperty("error", "Validation failed");
    });

    it("returns 400 when password is too short", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/setup",
        payload: { email: "admin@example.com", password: "short" },
      });

      expect(res.statusCode).toBe(400);
      const body = res.json();
      expect(body).toHaveProperty("error", "Validation failed");
    });
  });

  describe("POST /api/v1/admin/auth/login", () => {
    beforeEach(async () => {
      // Create admin for login tests
      await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/setup",
        payload: { email: "admin@example.com", password: "password123" },
      });
    });

    it("returns token for valid credentials (200)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/login",
        payload: { email: "admin@example.com", password: "password123" },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body).toHaveProperty("token");
      expect(typeof body.token).toBe("string");
    });

    it("returns 401 for wrong password", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/login",
        payload: { email: "admin@example.com", password: "wrongpassword" },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: "Invalid credentials" });
    });

    it("returns 401 for non-existent email", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/login",
        payload: { email: "nonexistent@example.com", password: "password123" },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json()).toMatchObject({ error: "Invalid credentials" });
    });

    it("returns 400 for invalid email format", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/login",
        payload: { email: "not-valid", password: "password123" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });

    it("returns 400 for password too short", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/login",
        payload: { email: "admin@example.com", password: "short" },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json()).toHaveProperty("error", "Validation failed");
    });
  });

  describe("Protected endpoints JWT guard", () => {
    it("returns 401 without JWT on protected endpoint", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/project",
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 401 with invalid JWT", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/project",
        headers: { authorization: "Bearer invalid.jwt.token" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("returns 200 with valid JWT", async () => {
      // Setup admin
      const setupRes = await app.inject({
        method: "POST",
        url: "/api/v1/admin/auth/setup",
        payload: { email: "admin@example.com", password: "password123" },
      });
      const { token } = setupRes.json();

      const res = await app.inject({
        method: "GET",
        url: "/api/v1/admin/project",
        headers: { authorization: `Bearer ${token}` },
      });

      expect(res.statusCode).toBe(200);
    });
  });
});
