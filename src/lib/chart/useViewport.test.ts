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

describe("clampDomain zoom-out limit (arbitrary zoom-out)", () => {
  const extent: [number, number] = [0, 1000];

  it("caps zoom-out at the extent by default", () => {
    // A window twice the data is pulled back to the extent.
    expect(clampDomain([-500, 1500], extent, 10)).toEqual([0, 1000]);
  });

  it("allows zooming out past the data up to maxSpan", () => {
    // maxSpan 2000 (2× the data) lets a centered 2000-wide window through.
    expect(clampDomain([-500, 1500], extent, 10, 2000)).toEqual([-500, 1500]);
  });

  it("keeps the data extent inside an over-zoomed window when panning", () => {
    // A 2000-wide window can slide, but never past the data's edges.
    expect(clampDomain([-2000, 0], extent, 10, 2000)).toEqual([-1000, 1000]); // data pinned right
    expect(clampDomain([1000, 3000], extent, 10, 2000)).toEqual([0, 2000]); // data pinned left
  });

  it("still floors the cap at the extent even if maxSpan is smaller", () => {
    expect(clampDomain([-500, 1500], extent, 10, 500)).toEqual([0, 1000]);
  });

  it("treats Infinity as arbitrary zoom-out", () => {
    const [d0, d1] = clampDomain([-4500, 5500], extent, 10, Number.POSITIVE_INFINITY);
    expect(d1 - d0).toBe(10000);
    // The data stays within the window.
    expect(d0).toBeLessThanOrEqual(0);
    expect(d1).toBeGreaterThanOrEqual(1000);
  });
});
