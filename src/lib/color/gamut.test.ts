import { describe, expect, it } from "vitest";
import { channelsToSrgb } from "./convert";
import { channelsInGamut, clampToSrgb, clipSrgb, srgbInGamut } from "./gamut";

describe("srgbInGamut", () => {
  it("accepts values inside [0,1] and rejects those outside", () => {
    expect(srgbInGamut([0, 0.5, 1])).toBe(true);
    expect(srgbInGamut([1.2, 0, 0])).toBe(false);
    expect(srgbInGamut([-0.1, 0, 0])).toBe(false);
  });
});

describe("clipSrgb", () => {
  it("clamps each channel into [0,1]", () => {
    expect(clipSrgb([1.4, -0.2, 0.5])).toEqual([1, 0, 0.5]);
  });
});

describe("channelsInGamut", () => {
  it("is true for an ordinary sRGB colour", () => {
    expect(channelsInGamut("rgb", [59, 130, 246])).toBe(true);
  });
  it("is false for a super-saturated OKLCH colour", () => {
    expect(channelsInGamut("oklch", [0.7, 0.37, 30])).toBe(false);
  });
});

describe("clampToSrgb", () => {
  it("leaves an in-gamut colour unchanged", () => {
    const ch = [0.62, 0.12, 258];
    expect(clampToSrgb("oklch", ch)).toEqual(ch);
  });

  it("reduces chroma until an out-of-gamut OKLCH colour fits sRGB", () => {
    const out = [0.7, 0.37, 30];
    const mapped = clampToSrgb("oklch", out);
    // Lightness + hue preserved, chroma reduced, and now in gamut.
    expect(mapped[0]).toBeCloseTo(0.7, 2);
    expect(mapped[2]).toBeCloseTo(30, 0);
    expect(mapped[1]).toBeLessThan(0.37);
    expect(srgbInGamut(channelsToSrgb("oklch", mapped))).toBe(true);
  });

  it("maps an out-of-gamut LCH colour into sRGB", () => {
    const out = [55, 130, 264];
    const mapped = clampToSrgb("lch", out);
    expect(srgbInGamut(channelsToSrgb("lch", mapped))).toBe(true);
  });
});
