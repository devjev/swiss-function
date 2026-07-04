import { describe, expect, it } from "vitest";
import { clampDomain, zoomDomain } from "./useViewport";

describe("zoomDomain", () => {
  it("holds the anchor value fixed while zooming in", () => {
    const [d0, d1] = zoomDomain([0, 100], 0.25, 2);
    // Anchor value 25 stays at the 25% mark of the new domain.
    expect(d0 + 0.25 * (d1 - d0)).toBeCloseTo(25);
    expect(d1 - d0).toBeCloseTo(50);
  });

  it("zooms out with factor < 1", () => {
    const [d0, d1] = zoomDomain([25, 75], 0.5, 0.5);
    expect(d1 - d0).toBeCloseTo(100);
    expect(d0 + 0.5 * (d1 - d0)).toBeCloseTo(50);
  });
});

describe("step zoom (the toolbar buttons compose zoomDomain + clampDomain)", () => {
  const extent: [number, number] = [0, 1000];

  it("zoom-in halves the span about the center", () => {
    const [d0, d1] = clampDomain(zoomDomain([200, 600], 0.5, 2), extent, 10);
    expect([d0, d1]).toEqual([300, 500]);
  });

  it("zoom-out doubles the span and clamps at the extent", () => {
    expect(clampDomain(zoomDomain([200, 600], 0.5, 0.5), extent, 10)).toEqual([0, 800]);
    // Zooming out from near-full lands exactly on the extent (reported as
    // reset by apply()).
    expect(clampDomain(zoomDomain([100, 900], 0.5, 0.5), extent, 10)).toEqual([0, 1000]);
  });
});

describe("clampDomain", () => {
  const extent: [number, number] = [0, 1000];

  it("caps zoom-out at the full extent", () => {
    expect(clampDomain([-500, 1500], extent, 10)).toEqual([0, 1000]);
  });

  it("floors zoom-in at minSpan, keeping position", () => {
    const [d0, d1] = clampDomain([400, 401], extent, 10);
    expect(d1 - d0).toBe(10);
    expect(d0).toBe(400);
  });

  it("shifts a pan past the edge back inside", () => {
    expect(clampDomain([-100, 100], extent, 10)).toEqual([0, 200]);
    expect(clampDomain([900, 1100], extent, 10)).toEqual([800, 1000]);
  });

  it("tolerates minSpan larger than the extent", () => {
    expect(clampDomain([200, 300], [0, 50], 500)).toEqual([0, 50]);
  });
});
