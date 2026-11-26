import { describe, expect, it } from "vitest";
import { nearestTarget } from "./useScrub";

describe("nearestTarget", () => {
  it("returns -1 without targets", () => {
    expect(nearestTarget([], 10, 10)).toBe(-1);
  });

  it("picks the mark under the finger", () => {
    const targets = [
      { x: 10, y: 50 },
      { x: 50, y: 50 },
      { x: 90, y: 50 },
    ];
    expect(nearestTarget(targets, 52, 48)).toBe(1);
  });

  it("follows the x axis: a mark above the finger beats a nearer one beside it", () => {
    const targets = [
      { x: 50, y: 10 }, // 60px above
      { x: 80, y: 70 }, // 30px to the side
    ];
    expect(nearestTarget(targets, 50, 70)).toBe(0);
  });
});
