import { describe, expect, it } from "vitest";
import { parse, toCss } from "./format";

const near = (a: number | undefined, b: number, eps = 0.5) =>
  Math.abs((a ?? Number.NaN) - b) <= eps;

describe("parse", () => {
  it("parses hex to rgb channels + alpha", () => {
    const p = parse("#3b82f6");
    expect(p?.space).toBe("rgb");
    expect(near(p?.channels[0], 59)).toBe(true);
    expect(near(p?.channels[1], 130)).toBe(true);
    expect(near(p?.channels[2], 246)).toBe(true);
    expect(p?.alpha).toBe(1);
  });

  it("parses rgb() with space and comma syntax", () => {
    expect(parse("rgb(10 20 30)")?.channels).toEqual([10, 20, 30]);
    expect(parse("rgb(10, 20, 30)")?.channels).toEqual([10, 20, 30]);
  });

  it("parses an alpha slash", () => {
    const p = parse("rgb(255 0 0 / 0.5)");
    expect(p?.alpha).toBeCloseTo(0.5, 3);
  });

  it("parses hsl with units", () => {
    const p = parse("hsl(210 50% 40%)");
    expect(p?.space).toBe("hsl");
    expect(near(p?.channels[0], 210)).toBe(true);
    expect(near(p?.channels[1], 50)).toBe(true);
  });

  it("parses oklch, oklab, lch, lab", () => {
    expect(parse("oklch(0.62 0.19 258)")?.space).toBe("oklch");
    expect(parse("oklch(0.62 0.19 258)")?.channels).toEqual([0.62, 0.19, 258]);
    expect(parse("oklab(0.62 -0.1 0.12)")?.space).toBe("oklab");
    expect(parse("lch(55 62 264)")?.space).toBe("lch");
    expect(parse("lab(55 -20 -40)")?.space).toBe("lab");
  });

  it("parses hue units (turn/rad)", () => {
    expect(near(parse("oklch(0.5 0.1 0.5turn)")?.channels[2], 180)).toBe(true);
  });

  it("returns null for nonsense (no DOM fallback in this env)", () => {
    expect(parse("definitely not a color ###")).toBeNull();
  });
});

describe("toCss", () => {
  it("auto → hex for an in-gamut opaque colour", () => {
    expect(toCss("rgb", [59, 130, 246], 1, "auto")).toBe("#3b82f6");
  });

  it("auto → 8-digit hex when alpha < 1", () => {
    expect(toCss("rgb", [255, 0, 0], 0.5, "auto")).toBe("#ff000080");
  });

  it("auto → oklch(...) when the colour is outside sRGB", () => {
    const css = toCss("oklch", [0.7, 0.37, 30], 1, "auto");
    expect(css.startsWith("oklch(")).toBe(true);
  });

  it("serializes each explicit space as its CSS function", () => {
    expect(toCss("rgb", [10, 20, 30], 1, "rgb")).toBe("rgb(10 20 30)");
    expect(toCss("hsl", [210, 50, 40], 1, "hsl")).toBe("hsl(210 50% 40%)");
    expect(toCss("oklch", [0.62, 0.19, 258], 1, "oklch")).toBe("oklch(0.62 0.19 258)");
  });

  it("converts before serializing to a different space", () => {
    // rgb → hsl output.
    expect(toCss("rgb", [255, 0, 0], 1, "hsl")).toBe("hsl(0 100% 50%)");
  });

  it("round-trips parse ∘ toCss for oklch", () => {
    const css = "oklch(0.62 0.19 258)";
    const p = parse(css);
    expect(p).not.toBeNull();
    if (p) expect(toCss(p.space, p.channels, p.alpha, "oklch")).toBe(css);
  });
});
