import { describe, expect, it } from "vitest";
import { blockSpans, flagFor, fmtTokens, positionalAttention, sumTokens } from "./attention";
import type { ContextBlock } from "./ContextEditor";

const block = (over: Partial<ContextBlock> & { tokens: number }): ContextBlock => ({
  id: "x",
  kind: "document",
  title: "t",
  ...over,
});

describe("positionalAttention", () => {
  it("is highest at the ends and lowest in the middle", () => {
    expect(positionalAttention(0)).toBeGreaterThan(positionalAttention(0.5));
    expect(positionalAttention(1)).toBeGreaterThan(positionalAttention(0.5));
  });

  it("is symmetric about 0.5", () => {
    expect(positionalAttention(0.2)).toBeCloseTo(positionalAttention(0.8), 10);
  });

  it("never drops to zero (floored)", () => {
    expect(positionalAttention(0.5)).toBeGreaterThan(0);
  });
});

describe("blockSpans", () => {
  it("returns empty for no blocks", () => {
    expect(blockSpans([])).toEqual([]);
  });

  it("assigns contiguous fractional spans that fill [0, 1]", () => {
    const spans = blockSpans([block({ tokens: 3 }), block({ id: "y", tokens: 1 })]);
    expect(spans[0]?.start).toBe(0);
    expect(spans[0]?.end).toBeCloseTo(0.75);
    expect(spans[1]?.start).toBeCloseTo(0.75);
    expect(spans[1]?.end).toBeCloseTo(1);
  });

  it("defaults salience to 1 when omitted (attention is positional only)", () => {
    const [s] = blockSpans([block({ tokens: 100 })]);
    expect(s?.effective).toBeCloseTo(s?.positional ?? 0);
  });

  it("scales effective attention by salience", () => {
    const [s] = blockSpans([block({ tokens: 100, salience: 0.5 })]);
    expect(s?.effective).toBeCloseTo((s?.positional ?? 0) * 0.5);
  });
});

describe("sumTokens", () => {
  it("sums token counts", () => {
    expect(sumTokens([block({ tokens: 3 }), block({ tokens: 2 })])).toBe(5);
  });
});

describe("fmtTokens", () => {
  it("formats compactly", () => {
    expect(fmtTokens(900)).toBe("900");
    expect(fmtTokens(41_800)).toBe("41.8k");
    expect(fmtTokens(128_000)).toBe("128k");
  });
});

describe("flagFor", () => {
  it("flags a large, low-attention block as wasted", () => {
    // A single 40k block sits at mid-window (low positional) with low salience.
    const [s] = blockSpans([block({ tokens: 40_000, salience: 0.1 })]);
    expect(s && flagFor(s)).toBe("wasted");
  });

  it("flags a small, high-salience block at the start as strong", () => {
    const [s] = blockSpans([
      block({ tokens: 100, salience: 0.9 }),
      block({ id: "y", tokens: 9_900 }),
    ]);
    expect(s && flagFor(s)).toBe("strong");
  });
});
