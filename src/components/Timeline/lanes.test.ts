import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { assignLanes } from "./lanes";

const MS_DAY = 24 * 60 * 60 * 1000;
const start = new Date(2026, 0, 1);
const day = (n: number) => new Date(start.getTime() + n * MS_DAY);

// Geometry cheat-sheet (pxPerDay 10, default gap 8):
//   marker x   = days × 10
//   label width = measure(label) + 8 (or chars × 7 + 8 unmeasured; JSX flat 80 + 8)
//   occupied   = [x, x + width + 8)
describe("assignLanes", () => {
  it("returns empty lanes and overflow for no events", () => {
    expect(assignLanes([], start, 10)).toEqual({ lanes: [], maxLane: 0, overflow: [] });
  });

  it("keeps non-colliding labels in lane 0 with the default estimate", () => {
    const events = [
      { date: day(0), label: "aaaa" }, // 4×7+8 = 36 wide, occupies 0..44
      { date: day(5), label: "bbbb" }, // starts at 50 ≥ 44
    ];
    const result = assignLanes(events, start, 10);
    expect(result.lanes).toEqual([0, 0]);
    expect(result.overflow).toEqual([false, false]);
    expect(result.maxLane).toBe(0);
  });

  it("an injected measurer changes lane assignments", () => {
    const events = [
      { date: day(0), label: "aaaa" },
      { date: day(5), label: "bbbb" },
    ];
    // Same events as above, but measured at 100px: first occupies 0..116, so
    // the second (start 50) no longer fits in lane 0.
    const result = assignLanes(events, start, 10, { measure: () => 100 });
    expect(result.lanes).toEqual([0, 1]);
    expect(result.overflow).toEqual([false, false]);
    expect(result.maxLane).toBe(1);
  });

  it("passes string and number labels to the measurer as-is", () => {
    const seen: unknown[] = [];
    assignLanes(
      [
        { date: day(0), label: "aaaa" },
        { date: day(5), label: 42 },
      ],
      start,
      10,
      {
        measure: (label) => {
          seen.push(label);
          return 10;
        },
      },
    );
    expect(seen).toEqual(["aaaa", 42]);
  });

  it("JSX labels keep the 80px fallback even when a measurer is injected", () => {
    const events = [
      { date: day(0), label: createElement("em", null, "x") }, // 80+8 wide, occupies 0..96
      { date: day(10), label: "bbbb" }, // starts at 100 ≥ 96
    ];
    // A 1000px measurement would force lane 1 if it applied to the JSX label.
    const result = assignLanes(events, start, 10, { measure: () => 1000 });
    expect(result.lanes[1]).toBe(0);
    expect(result.overflow).toEqual([false, false]);
  });

  it("flags overflow exactly when a label cannot be placed within maxLanes", () => {
    const events = [
      { date: day(0), label: "first" }, // occupies 0..116
      { date: day(5), label: "second" }, // starts at 50 — no free lane
      { date: day(15), label: "third" }, // starts at 150 ≥ 116 — fits again
    ];
    const result = assignLanes(events, start, 10, { maxLanes: 1, measure: () => 100 });
    // The overflowed event keeps a marker lane (the topmost allowed) but is
    // flagged; its hidden label reserves no space, so the third event — which
    // WOULD collide with the second's would-be extent (50..166) — still fits.
    expect(result.lanes).toEqual([0, 0, 0]);
    expect(result.overflow).toEqual([false, true, false]);
  });

  it("does not flag when enough lanes exist for every label", () => {
    const events = [
      { date: day(0), label: "first" },
      { date: day(5), label: "second" },
      { date: day(15), label: "third" },
    ];
    const result = assignLanes(events, start, 10, { maxLanes: 2, measure: () => 100 });
    expect(result.lanes).toEqual([0, 1, 0]);
    expect(result.overflow).toEqual([false, false, false]);
    expect(result.maxLane).toBe(1);
  });

  it("returns overflow flags in input order, not date order", () => {
    const events = [
      { date: day(5), label: "late" }, // processed second → overflows
      { date: day(0), label: "early" }, // processed first → lane 0
    ];
    const result = assignLanes(events, start, 10, { maxLanes: 1, measure: () => 100 });
    expect(result.lanes).toEqual([0, 0]);
    expect(result.overflow).toEqual([true, false]);
  });
});
