import { describe, expect, it } from "vitest";
import { formatNumber } from "./format";

describe("formatNumber (Swiss typography)", () => {
  it("groups thousands with apostrophes", () => {
    expect(formatNumber(1000)).toBe("1'000");
    expect(formatNumber(1284500)).toBe("1'284'500");
    expect(formatNumber(1234567890)).toBe("1'234'567'890");
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(0)).toBe("0");
  });

  it("uses a period decimal and keeps fraction digits", () => {
    expect(formatNumber(1234.5)).toBe("1'234.5");
    expect(formatNumber(1000.25)).toBe("1'000.25");
  });

  it("handles negatives with a hyphen-minus, not a dash", () => {
    expect(formatNumber(-1234)).toBe("-1'234");
    expect(formatNumber(-0)).toBe("0");
  });

  it("fixed decimals pad with zeros", () => {
    expect(formatNumber(1000, { decimals: 2 })).toBe("1'000.00");
    expect(formatNumber(1234.5, { decimals: 2 })).toBe("1'234.50");
    expect(formatNumber(1234.567, { decimals: 1 })).toBe("1'234.6");
  });

  it("maximumFractionDigits rounds and strips trailing zeros", () => {
    expect(formatNumber(12.5, { maximumFractionDigits: 1 })).toBe("12.5");
    expect(formatNumber(12.0, { maximumFractionDigits: 1 })).toBe("12");
    expect(formatNumber(12.53, { maximumFractionDigits: 1 })).toBe("12.5");
    expect(formatNumber(1000.04, { maximumFractionDigits: 2 })).toBe("1'000.04");
  });

  it("drops the sign when a negative rounds to zero (no -0.00)", () => {
    expect(formatNumber(-0.001, { decimals: 2 })).toBe("0.00");
    expect(formatNumber(-0.0004, { decimals: 3 })).toBe("0.000");
    // A genuinely nonzero small negative keeps its sign.
    expect(formatNumber(-0.001, { maximumFractionDigits: 3 })).toBe("-0.001");
  });

  it("avoids exponential notation for very small magnitudes", () => {
    expect(formatNumber(0.0000001)).toBe("0.0000001");
    expect(formatNumber(0.00001)).toBe("0.00001");
  });

  it("does not throw for an out-of-range decimals request", () => {
    expect(() => formatNumber(5, { decimals: 101 })).not.toThrow();
  });

  it("returns non-finite input as its plain string for the caller to guard", () => {
    expect(formatNumber(Number.NaN)).toBe("NaN");
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("Infinity");
  });
});
