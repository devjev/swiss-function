import { describe, expect, it } from "vitest";
import {
  channelsToSrgb,
  convert,
  hexToSrgb,
  type Srgb,
  srgbToChannels,
  srgbToHex,
} from "./convert";
import { SPACE_IDS } from "./spaces";

const close = (a: number, b: number, eps = 1e-3) => Math.abs(a - b) <= eps;
const srgbClose = (a: Srgb, b: Srgb, eps = 1e-3) => a.every((v, i) => close(v, b[i] ?? 0, eps));

// A spread of in-gamut sRGB colours (avoids pure black/white edges for hue).
const SAMPLES: Srgb[] = [
  [0.2, 0.4, 0.9],
  [0.9, 0.1, 0.3],
  [0.1, 0.7, 0.4],
  [0.5, 0.5, 0.5],
  [0.95, 0.85, 0.2],
  [0.05, 0.05, 0.05],
  [0.99, 0.99, 0.99],
];

describe("srgb ↔ channels round-trips", () => {
  for (const space of SPACE_IDS) {
    it(`${space} round-trips through sRGB`, () => {
      for (const srgb of SAMPLES) {
        const ch = srgbToChannels(space, srgb);
        const back = channelsToSrgb(space, ch);
        expect(srgbClose(back, srgb, 2e-3)).toBe(true);
      }
    });
  }
});

describe("convert between spaces", () => {
  it("is identity for same space", () => {
    expect(convert("rgb", "rgb", [10, 20, 30])).toEqual([10, 20, 30]);
  });

  it("round-trips rgb → oklch → rgb", () => {
    const rgb = [59, 130, 246];
    const okl = convert("rgb", "oklch", rgb);
    const back = convert("oklch", "rgb", okl);
    expect(back.every((v, i) => close(v, rgb[i] ?? 0, 0.6))).toBe(true);
  });

  it("round-trips rgb → lab → lch → rgb", () => {
    const rgb = [200, 90, 40];
    const lab = convert("rgb", "lab", rgb);
    const lch = convert("lab", "lch", lab);
    const back = convert("lch", "rgb", lch);
    expect(back.every((v, i) => close(v, rgb[i] ?? 0, 0.6))).toBe(true);
  });
});

describe("known reference values", () => {
  it("pure red is hsl(0 100% 50%)", () => {
    const [h, s, l] = convert("rgb", "hsl", [255, 0, 0]);
    expect(close(h ?? -1, 0, 0.5)).toBe(true);
    expect(close(s ?? -1, 100, 0.5)).toBe(true);
    expect(close(l ?? -1, 50, 0.5)).toBe(true);
  });

  it("white is near OKLCH L=1, C=0", () => {
    const [L, C] = convert("rgb", "oklch", [255, 255, 255]);
    expect(close(L ?? -1, 1, 2e-3)).toBe(true);
    expect(close(C ?? -1, 0, 2e-3)).toBe(true);
  });

  it("black is OKLCH L=0", () => {
    const [L] = convert("rgb", "oklch", [0, 0, 0]);
    expect(close(L ?? -1, 0, 2e-3)).toBe(true);
  });

  it("#3b82f6 OKLCH matches the known reference (L≈0.623, C≈0.188, H≈259.8)", () => {
    const [L, C, H] = convert("rgb", "oklch", [59, 130, 246]);
    expect(close(L ?? -1, 0.6231, 0.005)).toBe(true);
    expect(close(C ?? -1, 0.1884, 0.005)).toBe(true);
    expect(close(H ?? -1, 259.82, 1.2)).toBe(true);
  });

  it("preserves hue through an achromatic conversion via prevHue", () => {
    // Grey has no hue; without prevHue it collapses to 0, with it we keep 200.
    const grey: Srgb = [0.5, 0.5, 0.5];
    expect(srgbToChannels("oklch", grey)[2]).toBe(0);
    expect(srgbToChannels("oklch", grey, 200)[2]).toBe(200);
  });
});

describe("hex", () => {
  it("parses and serializes #rrggbb", () => {
    const hx = hexToSrgb("#3b82f6");
    expect(hx).not.toBeNull();
    expect(srgbToHex(hx?.srgb ?? [0, 0, 0])).toBe("#3b82f6");
  });

  it("expands shorthand and reads alpha", () => {
    const hx = hexToSrgb("#f003");
    expect(hx?.srgb[0]).toBeCloseTo(1, 5);
    expect(hx?.alpha).toBeCloseTo(0.2, 2);
  });

  it("emits 8-digit hex when alpha < 1", () => {
    expect(srgbToHex([1, 0, 0], 0.5)).toBe("#ff000080");
  });

  it("returns null for garbage", () => {
    expect(hexToSrgb("not-a-color")).toBeNull();
  });
});
