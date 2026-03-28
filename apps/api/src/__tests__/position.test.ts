import { describe, it, expect } from "vitest";
import { calculateNewPosition } from "../services/position.js";

describe("calculateNewPosition", () => {
  // ── Standard bump behaviour ──────────────────────────────────────────────
  describe("standard bumps", () => {
    it("bumps position by 1 (100, 1) → 99", () => {
      expect(calculateNewPosition(100, 1, undefined)).toBe(99);
    });

    it("bumps position by 5 (50, 5) → 45", () => {
      expect(calculateNewPosition(50, 5, undefined)).toBe(45);
    });

    it("bumps position by exact amount when result > 1", () => {
      expect(calculateNewPosition(10, 3, undefined)).toBe(7);
    });

    it("bumps a very large position (999999, 1) → 999998", () => {
      expect(calculateNewPosition(999999, 1, undefined)).toBe(999998);
    });

    it("bumps a very large position by a large amount", () => {
      expect(calculateNewPosition(999999, 999, undefined)).toBe(999000);
    });
  });

  // ── Floor behaviour at position 1 ────────────────────────────────────────
  describe("floor at 1", () => {
    it("floors to 1 when bump exceeds position (2, 5) → 1", () => {
      expect(calculateNewPosition(2, 5, undefined)).toBe(1);
    });

    it("floors to 1 when bump equals position (1, 1) → 1", () => {
      expect(calculateNewPosition(1, 1, undefined)).toBe(1);
    });

    it("floors to 1 for a very large bump (1, 100) → 1", () => {
      expect(calculateNewPosition(1, 100, undefined)).toBe(1);
    });

    it("floors to 1 when current position is 1 and bump is 1000", () => {
      expect(calculateNewPosition(1, 1000, undefined)).toBe(1);
    });

    it("bumps exactly to 1 (4, 3) → 1", () => {
      expect(calculateNewPosition(4, 3, undefined)).toBe(1);
    });
  });

  // ── Zero bump amount ──────────────────────────────────────────────────────
  describe("zero bump amount", () => {
    it("zero bump amount leaves position unchanged (50, 0) → 50", () => {
      expect(calculateNewPosition(50, 0, undefined)).toBe(50);
    });

    it("zero bump amount on position 1 leaves it at 1", () => {
      expect(calculateNewPosition(1, 0, undefined)).toBe(1);
    });

    it("zero bump amount with maxBumps defined leaves position unchanged", () => {
      expect(calculateNewPosition(50, 0, 5, 2)).toBe(50);
    });
  });

  // ── maxBumps limit enforcement ────────────────────────────────────────────
  describe("maxBumps limit", () => {
    it("blocks bump when totalBumpsApplied equals maxBumps (97, 1, 3, 3) → 97", () => {
      expect(calculateNewPosition(97, 1, 3, 3)).toBe(97);
    });

    it("blocks bump when totalBumpsApplied exceeds maxBumps (97, 1, 3, 5) → 97", () => {
      expect(calculateNewPosition(97, 1, 3, 5)).toBe(97);
    });

    it("allows bump when totalBumpsApplied is one below maxBumps (98, 1, 3, 2) → 97", () => {
      expect(calculateNewPosition(98, 1, 3, 2)).toBe(97);
    });

    it("allows bump when totalBumpsApplied is 0 and maxBumps is set (100, 5, 3, 0) → 95", () => {
      expect(calculateNewPosition(100, 5, 3, 0)).toBe(95);
    });

    it("maxBumps = 0 blocks all bumps when totalBumpsApplied = 0 (>= 0)", () => {
      // 0 >= 0 is true → position unchanged
      expect(calculateNewPosition(50, 5, 0, 0)).toBe(50);
    });

    it("maxBumps = 0 blocks bump even when totalBumpsApplied = 0", () => {
      expect(calculateNewPosition(10, 1, 0, 0)).toBe(10);
    });

    it("maxBumps = 1 allows exactly one bump (totalBumpsApplied = 0)", () => {
      expect(calculateNewPosition(50, 5, 1, 0)).toBe(45);
    });

    it("maxBumps = 1 blocks second bump (totalBumpsApplied = 1)", () => {
      expect(calculateNewPosition(45, 5, 1, 1)).toBe(45);
    });

    it("maxBumps undefined always allows bumping (no cap)", () => {
      expect(calculateNewPosition(50, 5, undefined, 9999)).toBe(45);
    });

    it("maxBumps undefined with default totalBumpsApplied of 0 still bumps", () => {
      expect(calculateNewPosition(50, 5, undefined)).toBe(45);
    });
  });

  // ── Default parameter for totalBumpsApplied ──────────────────────────────
  describe("default totalBumpsApplied", () => {
    it("defaults totalBumpsApplied to 0, allowing bump when maxBumps > 0", () => {
      expect(calculateNewPosition(50, 5, 3)).toBe(45);
    });

    it("defaults totalBumpsApplied to 0, blocks when maxBumps = 0", () => {
      expect(calculateNewPosition(50, 5, 0)).toBe(50);
    });
  });

  // ── Edge / boundary values ────────────────────────────────────────────────
  describe("edge cases", () => {
    it("position 2 bumped by 1 → 1 (floor boundary)", () => {
      expect(calculateNewPosition(2, 1, undefined)).toBe(1);
    });

    it("position 3 bumped by 2 → 1 (exact floor)", () => {
      expect(calculateNewPosition(3, 2, undefined)).toBe(1);
    });

    it("position 3 bumped by 1 → 2 (one above floor)", () => {
      expect(calculateNewPosition(3, 1, undefined)).toBe(2);
    });

    it("negative position is treated arithmetically — floor still applies", () => {
      // currentPosition=-1, bumpAmount=1 → -1-1=-2 → Math.max(1,-2) → 1
      expect(calculateNewPosition(-1, 1, undefined)).toBe(1);
    });

    it("negative position with zero bump still floors to 1", () => {
      // Math.max(1, -5-0) → Math.max(1,-5) → 1
      expect(calculateNewPosition(-5, 0, undefined)).toBe(1);
    });

    it("maxBumps exactly at limit (totalBumpsApplied = maxBumps) → no change", () => {
      expect(calculateNewPosition(80, 10, 5, 5)).toBe(80);
    });

    it("maxBumps one below limit allows bump", () => {
      expect(calculateNewPosition(80, 10, 5, 4)).toBe(70);
    });
  });
});
