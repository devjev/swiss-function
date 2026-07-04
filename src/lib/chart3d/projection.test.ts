import { describe, expect, it } from "vitest";
import {
  type Camera,
  computeFit,
  normalize,
  project,
  projectInto,
  type Viewport,
} from "./projection";

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

describe("projectInto", () => {
  it("matches project element-wise at an oblique camera (float32 tolerance)", () => {
    const cam: Camera = { azimuth: -0.6, elevation: 0.5 };
    const fit = computeFit(cam, VP);
    const nx = [-0.5, 0.25, 0, 0.5, -0.1];
    const ny = [0.5, -0.25, 0, -0.5, 0.3];
    const nz = [0, 0.5, -0.5, 0.25, -0.3];
    const outX = new Float32Array(nx.length);
    const outY = new Float32Array(nx.length);
    const outDepth = new Float32Array(nx.length);
    projectInto(nx, ny, nz, nx.length, cam, fit, outX, outY, outDepth);
    for (let i = 0; i < nx.length; i++) {
      const p = project(nx[i] as number, ny[i] as number, nz[i] as number, cam, fit);
      expect(close(outX[i] as number, p.x, 1e-3)).toBe(true);
      expect(close(outY[i] as number, p.y, 1e-3)).toBe(true);
      expect(close(outDepth[i] as number, p.depth, 1e-6)).toBe(true);
    }
  });
  it("only writes the first `count` entries", () => {
    const cam: Camera = { azimuth: 0.3, elevation: 0.2 };
    const fit = computeFit(cam, VP);
    const outX = new Float32Array([9, 9]);
    const outY = new Float32Array([9, 9]);
    const outDepth = new Float32Array([9, 9]);
    projectInto([0, 0], [0, 0], [0, 0], 1, cam, fit, outX, outY, outDepth);
    expect(outX[1]).toBe(9);
    expect(outY[1]).toBe(9);
    expect(outDepth[1]).toBe(9);
  });
});
