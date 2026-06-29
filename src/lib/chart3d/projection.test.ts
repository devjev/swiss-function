import { describe, expect, it } from "vitest";
import { type Camera, computeFit, normalize, project, type Viewport } from "./projection";

const VP: Viewport = { width: 100, height: 100, padding: 0 };
const FLAT: Camera = { azimuth: 0, elevation: 0 };
const close = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

describe("normalize", () => {
  it("centers a domain into [-0.5, 0.5]", () => {
    expect(normalize(0, [0, 10])).toBe(-0.5);
    expect(normalize(10, [0, 10])).toBe(0.5);
    expect(normalize(5, [0, 10])).toBe(0);
  });
  it("returns 0 for a degenerate domain", () => {
    expect(normalize(5, [5, 5])).toBe(0);
  });
});

describe("computeFit", () => {
  it("fits the unit cube edge-to-edge at a side-on camera", () => {
    const fit = computeFit(FLAT, VP);
    expect(fit.scale).toBe(100); // span 1 → 100px
    expect(fit.ox).toBe(50);
    expect(fit.oy).toBe(50);
  });
});

describe("project (side-on: azimuth 0, elevation 0)", () => {
  const fit = computeFit(FLAT, VP);
  it("puts the origin at the viewport center", () => {
    const p = project(0, 0, 0, FLAT, fit);
    expect(close(p.x, 50) && close(p.y, 50)).toBe(true);
  });
  it("maps +x to the right and +z (height) upward (canvas y grows down)", () => {
    expect(close(project(0.5, 0, 0, FLAT, fit).x, 100)).toBe(true);
    expect(close(project(0, 0, 0.5, FLAT, fit).y, 0)).toBe(true); // top edge
  });
});

describe("project (top-down: elevation π/2)", () => {
  const cam: Camera = { azimuth: 0, elevation: Math.PI / 2 };
  const fit = computeFit(cam, VP);
  it("collapses height and maps depth to the screen vertical", () => {
    expect(close(project(0, 0, 0.5, cam, fit).y, 50)).toBe(true); // height has no extent
    expect(close(project(0, 0.5, 0, cam, fit).y, 100)).toBe(true); // +depth → bottom
  });
});
