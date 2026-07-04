import { describe, expect, it } from "vitest";
import { nearestHit, nearestHitOrdered } from "./paint";

// Depth-sorted (far → near) points as PointCloud lays them out: pts is the
// object form nearestHit sees; xs/ys/order the buffer form nearestHitOrdered
// walks in the same painter's order.
const pts = [
  { x: 10, y: 10 },
  { x: 50, y: 50 },
  { x: 50, y: 50 }, // coincident with the previous, drawn later (nearer)
  { x: 90, y: 10 },
];
const xs = [50, 10, 90, 50]; // storage order ≠ painter's order
const ys = [50, 10, 10, 50];
const order = [1, 0, 3, 2]; // far → near: pts[k] === (xs, ys)[order[k]]

describe("nearestHit", () => {
  it("returns the closest point within maxDist", () => {
    expect(nearestHit(pts, 12, 12, 12)).toBe(0);
  });
  it("returns -1 when nothing is in range", () => {
    expect(nearestHit(pts, 200, 200, 12)).toBe(-1);
  });
});

describe("nearestHitOrdered", () => {
  it("agrees with nearestHit over the same painter's order", () => {
    for (const [px, py] of [
      [12, 12],
      [52, 48],
      [88, 12],
      [200, 200],
    ] as const) {
      const expected = nearestHit(pts, px, py, 12);
      const got = nearestHitOrdered(xs, ys, order, order.length, px, py, 12);
      // nearestHit returns a painter's-order index; ordered returns the buffer index.
      expect(got).toBe(expected >= 0 ? (order[expected] as number) : -1);
    }
  });
  it("later order entries win exact ties (the visible nearer point)", () => {
    // pts[1] and pts[2] coincide at (50, 50); the later-drawn one must win.
    expect(nearestHit(pts, 50, 50, 12)).toBe(2);
    expect(nearestHitOrdered(xs, ys, order, order.length, 50, 50, 12)).toBe(order[2]);
  });
  it("only inspects the first `count` order entries", () => {
    expect(nearestHitOrdered(xs, ys, order, 1, 12, 12, 12)).toBe(1);
  });
});
