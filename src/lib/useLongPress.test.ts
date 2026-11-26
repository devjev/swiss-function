import { describe, expect, it } from "vitest";
import { movedPast } from "./useLongPress";

describe("movedPast", () => {
  it("allows a wander inside the tolerance", () => {
    expect(movedPast({ x: 10, y: 10 }, { x: 14, y: 13 }, 8)).toBe(false);
    expect(movedPast({ x: 10, y: 10 }, { x: 10, y: 18 }, 8)).toBe(false);
  });

  it("reports a finger that left the spot, on a diagonal too", () => {
    expect(movedPast({ x: 10, y: 10 }, { x: 10, y: 19 }, 8)).toBe(true);
    expect(movedPast({ x: 10, y: 10 }, { x: 16, y: 16 }, 8)).toBe(true);
  });
});
