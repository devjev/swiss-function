import { afterEach, describe, expect, it } from "vitest";
import { clearTextMeasureCache, getTextMeasurer, resolveTickFont } from "./textMeasure";

// Vitest runs in the node environment: no `document`, no canvas 2d context.
// That exercises exactly the SSR fallback of resolveTickFont and the
// estimator path of getTextMeasurer.

afterEach(() => {
  clearTextMeasureCache();
});

describe("resolveTickFont (SSR fallback)", () => {
  it("returns a deterministic mono font string without a document", () => {
    expect(resolveTickFont(null)).toBe("400 14px monospace");
    expect(resolveTickFont(null, "mono")).toBe("400 14px monospace");
  });

  it("returns a deterministic sans font string without a document", () => {
    expect(resolveTickFont(null, "sans")).toBe("400 14px sans-serif");
  });

  it("is stable across calls", () => {
    expect(resolveTickFont(null)).toBe(resolveTickFont(null));
  });
});

describe("getTextMeasurer (estimator path)", () => {
  it("scales linearly with text length", () => {
    const measure = getTextMeasurer("400 14px monospace");
    const one = measure("a");
    expect(one).toBeGreaterThan(0);
    expect(measure("ab")).toBeCloseTo(2 * one, 10);
    expect(measure("abcdefgh")).toBeCloseTo(8 * one, 10);
  });

  it("returns 0 for the empty string", () => {
    expect(getTextMeasurer("400 14px monospace")("")).toBe(0);
  });

  it("scales with the size parsed from the font string", () => {
    const at14 = getTextMeasurer("400 14px monospace")("1234");
    const at28 = getTextMeasurer("400 28px monospace")("1234");
    expect(at28).toBeCloseTo(2 * at14, 10);
  });

  it("parses fractional sizes and falls back to 14px when none is present", () => {
    const at13125 = getTextMeasurer("400 13.125px monospace")("00");
    expect(at13125).toBeCloseTo(2 * 0.62 * 13.125, 10);
    const noSize = getTextMeasurer("bold monospace")("00");
    expect(noSize).toBeCloseTo(2 * 0.62 * 14, 10);
  });

  it("returns identical values across repeat calls and across measurers for one font", () => {
    const a = getTextMeasurer("400 14px monospace");
    const b = getTextMeasurer("400 14px monospace");
    const first = a("42.5k");
    expect(a("42.5k")).toBe(first);
    expect(b("42.5k")).toBe(first);
  });

  it("re-measures to the same value after clearTextMeasureCache", () => {
    const measure = getTextMeasurer("400 14px monospace");
    const before = measure("1.5M");
    clearTextMeasureCache();
    expect(measure("1.5M")).toBe(before);
    expect(getTextMeasurer("400 14px monospace")("1.5M")).toBe(before);
  });
});
