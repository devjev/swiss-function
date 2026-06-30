import { describe, expect, it } from "vitest";
import { parseComputedColor } from "./shading";

describe("parseComputedColor", () => {
  it("parses rgb(…) channels as 0–255", () => {
    expect(parseComputedColor("rgb(110, 110, 110)")).toEqual([110, 110, 110]);
    expect(parseComputedColor("rgb(10 20 30)")).toEqual([10, 20, 30]);
  });

  it("parses rgba(…), ignoring the alpha channel", () => {
    expect(parseComputedColor("rgba(255, 0, 0, 0.5)")).toEqual([255, 0, 0]);
  });

  // Regression: Chromium serializes a resolved color-mix() as `color(srgb …)`
  // with 0–1 floats. Reading those as 0–255 collapsed every mix to near-black.
  it("scales a color(srgb …) serialization from 0–1 up to 0–255", () => {
    const [r, g, b] = parseComputedColor("color(srgb 0.5 0.5 0.5)") ?? [];
    expect(r).toBeCloseTo(127.5);
    expect(g).toBeCloseTo(127.5);
    expect(b).toBeCloseTo(127.5);
    expect(parseComputedColor("color(srgb 0 1 0)")).toEqual([0, 255, 0]);
  });

  it("returns null when there are fewer than three channels", () => {
    expect(parseComputedColor("transparent")).toBeNull();
    expect(parseComputedColor("")).toBeNull();
  });
});
