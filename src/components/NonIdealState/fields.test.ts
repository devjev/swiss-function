import { describe, expect, it } from "vitest";
import { MAX_LEVEL, noise, quantize, ripple, vignette } from "./fields";

describe("quantize", () => {
  it("maps 0 → level 0 and 1 → MAX_LEVEL", () => {
    expect(quantize(0, 0, 0)).toBe(0);
    expect(quantize(1, 0, 0)).toBe(MAX_LEVEL);
  });
  it("clamps out-of-range intensities", () => {
    expect(quantize(-5, 2, 3)).toBe(0);
    expect(quantize(9, 2, 3)).toBe(MAX_LEVEL);
  });
  it("always returns an integer level within range", () => {
    for (let i = 0; i <= 10; i++) {
      const lvl = quantize(i / 10, i % 4, (i * 3) % 4);
      expect(Number.isInteger(lvl)).toBe(true);
      expect(lvl).toBeGreaterThanOrEqual(0);
      expect(lvl).toBeLessThanOrEqual(MAX_LEVEL);
    }
  });
});

describe("vignette", () => {
  it("is darker at the corner than the center", () => {
    const center = vignette(10, 6, 21, 13);
    const corner = vignette(0, 0, 21, 13);
    expect(corner).toBeGreaterThan(center);
  });
  it("clears the center (intensity 0)", () => {
    expect(vignette(10, 6, 21, 13)).toBe(0);
  });
});

describe("ripple", () => {
  it("stays within [0, amplitude]", () => {
    for (let t = 0; t < 3; t += 0.3) {
      for (let x = 0; x < 12; x++) {
        const v = ripple(x, 5, 20, 12, t, { amplitude: 0.8 });
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(0.8 + 1e-9);
      }
    }
  });
  it("advances with time (the field is not static)", () => {
    const a = ripple(3, 3, 20, 12, 0);
    const b = ripple(3, 3, 20, 12, 0.5);
    expect(a).not.toBeCloseTo(b, 5);
  });
});

describe("noise", () => {
  it("is deterministic for the same cell, frame, and seed", () => {
    expect(noise(4, 7, 20, 12, 0.0, { seed: 3 })).toBe(noise(4, 7, 20, 12, 0.04, { seed: 3 }));
  });
  it("re-rolls across frames", () => {
    const a = noise(4, 7, 20, 12, 0.0, { rate: 10, seed: 3 });
    const b = noise(4, 7, 20, 12, 1.0, { rate: 10, seed: 3 });
    expect(a).not.toBe(b);
  });
  it("differs across seeds", () => {
    expect(noise(4, 7, 20, 12, 0, { seed: 1 })).not.toBe(noise(4, 7, 20, 12, 0, { seed: 2 }));
  });
});
