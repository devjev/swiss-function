import { describe, expect, it } from "vitest";
import { SPINNERS, type SpinnerVariant, spinnerStill } from "./spinners";

const names = Object.keys(SPINNERS) as SpinnerVariant[];

describe("SPINNERS registry", () => {
  it("has 28 variants", () => {
    expect(names).toHaveLength(28);
  });

  it("every variant has >= 2 non-empty frames and a positive interval", () => {
    for (const name of names) {
      const spec = SPINNERS[name];
      expect(spec.frames.length, name).toBeGreaterThanOrEqual(2);
      expect(
        spec.frames.every((f) => f.length > 0),
        name,
      ).toBe(true);
      expect(spec.interval, name).toBeGreaterThan(0);
    }
  });

  it("resolves a still frame for every variant", () => {
    for (const name of names) {
      expect(spinnerStill(name), name).toBeTruthy();
    }
  });

  it("blocks uses density/shade glyphs", () => {
    expect(SPINNERS.blocks.frames.join("")).toMatch(/[░▒▓█]/);
  });

  it("every variant's frames are a single uniform width (no layout jitter)", () => {
    for (const name of names) {
      const widths = new Set(SPINNERS[name].frames.map((f) => [...f].length));
      expect(widths.size, name).toBe(1);
    }
  });
});
