import { describe, expect, it } from "vitest";
import { adaptiveTicks, formatTickValue, niceTicks } from "./numericTicks";

describe("formatTickValue", () => {
  it("derives precision from the step so adjacent labels stay distinct", () => {
    expect(formatTickValue(1.234, 0.001)).toBe("1.234");
    expect(formatTickValue(1.235, 0.001)).toBe("1.235");
    expect(formatTickValue(0.05, 0.05)).toBe("0.05");
    expect(formatTickValue(5, 5)).toBe("5");
  });

  it("keeps compact suffixes only while two decimals keep ticks distinct", () => {
    expect(formatTickValue(1_500_000, 500_000)).toBe("1.5M");
    expect(formatTickValue(1500, 500)).toBe("1.5k");
    expect(formatTickValue(1530, 10)).toBe("1.53k");
    // Step 1 at magnitude 1501 would need "1.501k" — expand instead.
    expect(formatTickValue(1501, 1)).toBe("1501");
  });

  it("handles zero and negatives", () => {
    expect(formatTickValue(0, 0.1)).toBe("0");
    expect(formatTickValue(-0.25, 0.05)).toBe("-0.25");
  });
});

describe("adaptiveTicks", () => {
  it("keeps ticks strictly inside the zoomed domain", () => {
    const { ticks } = adaptiveTicks(3.7, 18.2, 640);
    expect(ticks.length).toBeGreaterThan(3);
    for (const t of ticks) {
      expect(t.value).toBeGreaterThanOrEqual(3.7);
      expect(t.value).toBeLessThanOrEqual(18.2);
    }
  });

  it("scales tick count with pixel width", () => {
    const narrow = adaptiveTicks(0, 100, 200).ticks.length;
    const wide = adaptiveTicks(0, 100, 1600).ticks.length;
    expect(wide).toBeGreaterThan(narrow * 2);
  });

  it("produces distinct labels at any zoom depth", () => {
    const { ticks } = adaptiveTicks(1.2341, 1.2349, 640);
    const labels = ticks.map((t) => t.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(ticks.length).toBeGreaterThan(2);
  });

  it("factors out a shared offset for tiny spans at large magnitudes", () => {
    const { ticks, offset, offsetLabel } = adaptiveTicks(1_234_100, 1_234_900, 640);
    expect(offset).toBe(1_234_000);
    expect(offsetLabel).toBe("+1.234M");
    // Labels show only the varying part.
    for (const t of ticks) {
      expect(Math.abs(Number(t.label))).toBeLessThan(1000);
    }
    // Values stay absolute (they position the ticks on the real scale).
    const first = ticks[0];
    expect(first?.value).toBeGreaterThan(1_234_000);
  });

  it("uses no offset when the span covers the magnitude", () => {
    const { offset, offsetLabel } = adaptiveTicks(0, 5000, 640);
    expect(offset).toBe(0);
    expect(offsetLabel).toBe("");
  });

  it("promotes higher-order rollovers as major", () => {
    // Step 100 over [4300, 6800] → 1000-boundaries are the promoted ticks.
    const { ticks } = adaptiveTicks(4321, 6789, 1800, 60);
    const at5000 = ticks.find((t) => t.value === 5000);
    const at5100 = ticks.find((t) => t.value === 5100);
    expect(at5000?.major).toBe(true);
    expect(at5100?.major).toBe(false);
  });

  it("returns empty for degenerate input", () => {
    expect(adaptiveTicks(5, 5, 640).ticks).toEqual([]);
    expect(adaptiveTicks(0, 10, 0).ticks).toEqual([]);
    expect(adaptiveTicks(Number.NaN, 10, 640).ticks).toEqual([]);
  });
});

describe("niceTicks (existing contract still holds)", () => {
  it("extends to nice boundaries and marks zero major", () => {
    const ticks = niceTicks(-7, 23, 6);
    expect(ticks[0]?.value).toBeLessThanOrEqual(-7);
    expect(ticks[ticks.length - 1]?.value).toBeGreaterThanOrEqual(23);
    expect(ticks.find((t) => t.value === 0)?.major).toBe(true);
  });
});
