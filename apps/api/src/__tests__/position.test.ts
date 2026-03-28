import { describe, it, expect } from "vitest";
import { calculateNewPosition } from "../services/position.js";

describe("calculateNewPosition", () => {
  it("bumps position by configured amount", () => {
    expect(calculateNewPosition(100, 1, undefined)).toBe(99);
  });

  it("bumps by custom amount", () => {
    expect(calculateNewPosition(50, 5, undefined)).toBe(45);
  });

  it("does not go below position 1", () => {
    expect(calculateNewPosition(2, 5, undefined)).toBe(1);
  });

  it("respects maxBumps cap", () => {
    expect(calculateNewPosition(97, 1, 3, 3)).toBe(97);
  });

  it("allows bump when under maxBumps", () => {
    expect(calculateNewPosition(98, 1, 3, 2)).toBe(97);
  });
});
