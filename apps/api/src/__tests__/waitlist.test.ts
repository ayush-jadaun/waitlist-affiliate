import { describe, it, expect } from "vitest";
import { WaitlistService } from "../services/waitlist.js";

const service = new WaitlistService();

// ── getInitialStatus ──────────────────────────────────────────────────────────
describe("WaitlistService.getInitialStatus", () => {
  it("returns 'waiting' for prelaunch mode", () => {
    expect(service.getInitialStatus("prelaunch")).toBe("waiting");
  });

  it("returns 'pending' for gated mode", () => {
    expect(service.getInitialStatus("gated")).toBe("pending");
  });

  it("returns 'active' for viral mode", () => {
    expect(service.getInitialStatus("viral")).toBe("active");
  });

  it("prelaunch status is not 'active'", () => {
    expect(service.getInitialStatus("prelaunch")).not.toBe("active");
  });

  it("gated status is not 'waiting'", () => {
    expect(service.getInitialStatus("gated")).not.toBe("waiting");
  });

  it("viral status is not 'pending'", () => {
    expect(service.getInitialStatus("viral")).not.toBe("pending");
  });

  it("each mode returns a distinct status", () => {
    const statuses = [
      service.getInitialStatus("prelaunch"),
      service.getInitialStatus("gated"),
      service.getInitialStatus("viral"),
    ];
    const unique = new Set(statuses);
    expect(unique.size).toBe(3);
  });

  it("returns a string value for every valid mode", () => {
    const modes = ["prelaunch", "gated", "viral"] as const;
    for (const mode of modes) {
      expect(typeof service.getInitialStatus(mode)).toBe("string");
    }
  });
});

// ── shouldAssignPosition ──────────────────────────────────────────────────────
describe("WaitlistService.shouldAssignPosition", () => {
  it("returns true for prelaunch mode", () => {
    expect(service.shouldAssignPosition("prelaunch")).toBe(true);
  });

  it("returns false for gated mode", () => {
    expect(service.shouldAssignPosition("gated")).toBe(false);
  });

  it("returns true for viral mode", () => {
    expect(service.shouldAssignPosition("viral")).toBe(true);
  });

  it("gated is the only mode that does NOT assign a position", () => {
    const modes = ["prelaunch", "gated", "viral"] as const;
    const results = modes.map((m) => service.shouldAssignPosition(m));
    // Only gated returns false
    expect(results.filter((r) => r === false).length).toBe(1);
    expect(service.shouldAssignPosition("gated")).toBe(false);
  });

  it("prelaunch and viral both return true", () => {
    expect(service.shouldAssignPosition("prelaunch")).toBe(true);
    expect(service.shouldAssignPosition("viral")).toBe(true);
  });

  it("returns a boolean for every valid mode", () => {
    const modes = ["prelaunch", "gated", "viral"] as const;
    for (const mode of modes) {
      expect(typeof service.shouldAssignPosition(mode)).toBe("boolean");
    }
  });
});
