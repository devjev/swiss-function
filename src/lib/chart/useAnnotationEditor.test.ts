import { describe, expect, it } from "vitest";
import type { ChartAnnotation } from "./Annotations";
import { draftFromDrag, moveAnnotationPoint, translateAnnotation } from "./useAnnotationEditor";

const P1 = { x: new Date(2026, 0, 10), y: 100 };
const P2 = { x: new Date(2026, 2, 5), y: 140 };

describe("draftFromDrag", () => {
  it("builds two-point shapes for the drag tools", () => {
    expect(draftFromDrag("line", P1, P2)).toEqual({
      type: "line",
      x1: P1.x,
      y1: 100,
      x2: P2.x,
      y2: 140,
    });
    expect(draftFromDrag("measure", P1, P2)?.type).toBe("measure");
    expect(draftFromDrag("rect", P1, P2)).toEqual({
      type: "rect",
      x1: P1.x,
      y1: 100,
      x2: P2.x,
      y2: 140,
    });
  });

  it("returns null for click-place tools", () => {
    for (const tool of ["select", "hline", "vline", "text"] as const) {
      expect(draftFromDrag(tool, P1, P2)).toBeNull();
    }
  });
});

describe("translateAnnotation", () => {
  const DAY = 86_400_000;

  it("preserves Date-ness of x anchors", () => {
    const line: ChartAnnotation = { type: "line", x1: P1.x, y1: 100, x2: P2.x, y2: 140 };
    const moved = translateAnnotation(line, 2 * DAY, -5);
    if (moved.type !== "line") throw new Error("type changed");
    expect(moved.x1).toBeInstanceOf(Date);
    expect((moved.x1 as Date).getTime()).toBe(P1.x.getTime() + 2 * DAY);
    expect(moved.y1).toBe(95);
    expect(moved.y2).toBe(135);
  });

  it("moves numeric anchors numerically", () => {
    const v: ChartAnnotation = { type: "vline", x: 50 };
    expect(translateAnnotation(v, 7, 999)).toEqual({ type: "vline", x: 57 });
    const h: ChartAnnotation = { type: "hline", y: 10 };
    expect(translateAnnotation(h, 999, -3)).toEqual({ type: "hline", y: 7 });
  });

  it("keeps full-height rects full-height (undefined y anchors stay undefined)", () => {
    const band: ChartAnnotation = { type: "rect", x1: 10, x2: 20 };
    const moved = translateAnnotation(band, 5, 100);
    if (moved.type !== "rect") throw new Error("type changed");
    expect(moved.x1).toBe(15);
    expect(moved.x2).toBe(25);
    expect(moved.y1).toBeUndefined();
    expect(moved.y2).toBeUndefined();
  });

  it("preserves id/color/label passthrough", () => {
    const a: ChartAnnotation = { type: "hline", y: 5, id: "k", label: "L", color: "red" };
    expect(translateAnnotation(a, 0, 1)).toEqual({ ...a, y: 6 });
  });
});

describe("moveAnnotationPoint", () => {
  it("moves exactly one anchor of two-point shapes", () => {
    const line: ChartAnnotation = { type: "line", x1: 1, y1: 2, x2: 3, y2: 4 };
    expect(moveAnnotationPoint(line, "p1", 10, 20)).toEqual({
      type: "line",
      x1: 10,
      y1: 20,
      x2: 3,
      y2: 4,
    });
    expect(moveAnnotationPoint(line, "p2", 10, 20)).toEqual({
      type: "line",
      x1: 1,
      y1: 2,
      x2: 10,
      y2: 20,
    });
  });

  it("hline takes only y; vline only x", () => {
    expect(moveAnnotationPoint({ type: "hline", y: 5 }, "p1", 99, 8)).toEqual({
      type: "hline",
      y: 8,
    });
    expect(moveAnnotationPoint({ type: "vline", x: 5 }, "p1", 99, 8)).toEqual({
      type: "vline",
      x: 99,
    });
  });

  it("full-height rect anchors move only in x", () => {
    const band: ChartAnnotation = { type: "rect", x1: 10, x2: 20 };
    const moved = moveAnnotationPoint(band, "p1", 12, 55);
    if (moved.type !== "rect") throw new Error("type changed");
    expect(moved.x1).toBe(12);
    expect(moved.y1).toBeUndefined();
  });

  it("body part is a no-op (that's translateAnnotation's job)", () => {
    const a: ChartAnnotation = { type: "hline", y: 5 };
    expect(moveAnnotationPoint(a, "body", 1, 2)).toBe(a);
  });
});
