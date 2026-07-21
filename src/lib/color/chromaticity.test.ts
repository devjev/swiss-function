import { describe, expect, it } from "vitest";
import { SRGB_PRIMARIES, SRGB_WHITE, xyOf } from "./chromaticity";
import { type Srgb, srgbToXy, srgbToXyz, xyzToSrgb } from "./convert";

const near = (a: number, b: number, eps = 0.004) => Math.abs(a - b) <= eps;

describe("srgbToXy / xyOf", () => {
  it("white sits at the D65 white point", () => {
    const xy = srgbToXy([1, 1, 1]);
    expect(xy).not.toBeNull();
    expect(near(xy?.[0] ?? 0, SRGB_WHITE[0])).toBe(true);
    expect(near(xy?.[1] ?? 0, SRGB_WHITE[1])).toBe(true);
  });

  it("the primaries land on the sRGB triangle vertices", () => {
    const red = srgbToXy([1, 0, 0]);
    const green = srgbToXy([0, 1, 0]);
    const blue = srgbToXy([0, 0, 1]);
    expect(near(red?.[0] ?? 0, SRGB_PRIMARIES[0][0])).toBe(true);
    expect(near(red?.[1] ?? 0, SRGB_PRIMARIES[0][1])).toBe(true);
    expect(near(green?.[0] ?? 0, SRGB_PRIMARIES[1][0])).toBe(true);
    expect(near(blue?.[1] ?? 0, SRGB_PRIMARIES[2][1])).toBe(true);
  });

  it("returns null for black", () => {
    expect(srgbToXy([0, 0, 0])).toBeNull();
  });

  it("srgbToXyz ∘ xyzToSrgb round-trips", () => {
    const rgb: Srgb = [0.2, 0.6, 0.9];
    const back = xyzToSrgb(srgbToXyz(rgb));
    expect(back.every((v, i) => Math.abs(v - (rgb[i] ?? 0)) < 1e-6)).toBe(true);
  });

  it("xyOf maps a colour's channels to xy", () => {
    const xy = xyOf("rgb", [255, 255, 255]);
    expect(near(xy?.[0] ?? 0, SRGB_WHITE[0])).toBe(true);
  });

  it("a wide-gamut OKLCH colour plots outside the sRGB triangle", () => {
    const tri = SRGB_PRIMARIES;
    type P = readonly [number, number];
    const cross = (o: P, p: P, q: P) =>
      (p[0] - o[0]) * (q[1] - o[1]) - (q[0] - o[0]) * (p[1] - o[1]);
    const inside = (pt: [number, number]) => {
      const d = [cross(pt, tri[0], tri[1]), cross(pt, tri[1], tri[2]), cross(pt, tri[2], tri[0])];
      return !(d.some((v) => v < 0) && d.some((v) => v > 0));
    };
    // A super-saturated green beyond sRGB → negative primary components → its
    // chromaticity lies outside the triangle. White is comfortably inside.
    const oog = xyOf("oklch", [0.85, 0.3, 140]);
    const white = xyOf("rgb", [255, 255, 255]);
    expect(oog).not.toBeNull();
    expect(inside(oog as [number, number])).toBe(false);
    expect(inside(white as [number, number])).toBe(true);
  });
});
