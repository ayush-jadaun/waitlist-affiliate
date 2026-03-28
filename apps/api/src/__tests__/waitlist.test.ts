import { describe, it, expect } from "vitest";
import { WaitlistService } from "../services/waitlist.js";

describe("WaitlistService", () => {
  it("assigns waiting status in prelaunch mode", () => {
    const service = new WaitlistService();
    expect(service.getInitialStatus("prelaunch")).toBe("waiting");
  });

  it("assigns pending status in gated mode", () => {
    const service = new WaitlistService();
    expect(service.getInitialStatus("gated")).toBe("pending");
  });

  it("assigns active status in viral mode", () => {
    const service = new WaitlistService();
    expect(service.getInitialStatus("viral")).toBe("active");
  });

  it("assigns position in prelaunch mode", () => {
    const service = new WaitlistService();
    expect(service.shouldAssignPosition("prelaunch")).toBe(true);
  });

  it("does not assign position in gated mode", () => {
    const service = new WaitlistService();
    expect(service.shouldAssignPosition("gated")).toBe(false);
  });

  it("assigns position in viral mode", () => {
    const service = new WaitlistService();
    expect(service.shouldAssignPosition("viral")).toBe(true);
  });
});
