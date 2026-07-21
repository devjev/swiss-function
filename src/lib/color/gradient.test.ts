import { describe, expect, it } from "vitest";
import { channelGradient } from "./gradient";

// A zero-alpha stop (`#rrggbb00 `) marks an out-of-gamut sample.
const hasOogStop = (g: string) => /#[0-9a-f]{6}00 /.test(g);

describe("channelGradient", () => {
  it("marks out-of-gamut stops on the chroma track when asked", () => {
    // At L=0.62 H=258, chroma runs past sRGB before the channel max (0.4).
    expect(hasOogStop(channelGradient("oklch", [0.62, 0.2, 258], 1, true))).toBe(true);
  });

  it("does not mark when the flag is off", () => {
    expect(hasOogStop(channelGradient("oklch", [0.62, 0.2, 258], 1, false))).toBe(false);
  });

  it("never marks the hue channel (keeps a clean rainbow)", () => {
    expect(hasOogStop(channelGradient("oklch", [0.62, 0.2, 258], 2, true))).toBe(false);
  });

  it("marks nothing for an always-in-gamut space (RGB)", () => {
    expect(hasOogStop(channelGradient("rgb", [59, 130, 246], 0, true))).toBe(false);
  });

  it("returns a linear-gradient string", () => {
    expect(channelGradient("oklch", [0.62, 0.19, 258], 0)).toMatch(/^linear-gradient\(to right, /);
  });
});
