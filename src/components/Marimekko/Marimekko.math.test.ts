import { describe, expect, it } from "vitest";
import {
  cleanValue,
  columnTotals,
  ditherCells,
  ditherDots,
  fitBandLabels,
  formatShare,
  indexToPx,
  labelFits,
  layoutBands,
  pxToIndex,
  rampStrength,
  stackColumn,
  widthMeasures,
} from "./Marimekko.math";

const measure = (t: string) => t.length * 7;
const ellipsize = (text: string, maxPx: number, m: (t: string) => number) => {
  if (m(text) <= maxPx) return text;
  for (let n = text.length - 1; n >= 1; n--) {
    const s = `${text.slice(0, n)}…`;
    if (m(s) <= maxPx) return s;
  }
  return "";
};

describe("cleanValue / columnTotals / widthMeasures", () => {
  it("drops negatives, NaN and missing values", () => {
    expect(cleanValue(-3)).toBe(0);
    expect(cleanValue(Number.NaN)).toBe(0);
    expect(cleanValue(undefined)).toBe(0);
    expect(cleanValue(2.5)).toBe(2.5);
  });

  it("sums every series per category, tolerating short rows", () => {
    expect(
      columnTotals(
        [
          [1, 2, 3],
          [4, 5],
        ],
        3,
      ),
    ).toEqual([5, 7, 3]);
  });

  it("uses the totals by default and an explicit measure when given", () => {
    expect(widthMeasures([5, 7, 3], undefined)).toEqual([5, 7, 3]);
    expect(widthMeasures([5, 7, 3], "total")).toEqual([5, 7, 3]);
    expect(widthMeasures([5, 7, 3], [10, 0, -1])).toEqual([10, 0, 0]);
  });
});

describe("layoutBands", () => {
  it("shares the axis by measure after the gaps, edges on whole px", () => {
    const bands = layoutBands([1, 3], 101, 1);
    expect(bands).toEqual([
      { start: 0, size: 25 },
      { start: 26, size: 75 },
    ]);
  });

  it("splits equally when every measure is zero", () => {
    const bands = layoutBands([0, 0, 0], 300, 0);
    expect(bands.map((b) => b.size)).toEqual([100, 100, 100]);
  });

  it("gives a tiny column one px rather than none", () => {
    const bands = layoutBands([1000, 1], 400, 1);
    expect(bands[1]?.size).toBe(1);
    expect((bands[0]?.start ?? 0) + (bands[0]?.size ?? 0) + 1).toBe(bands[1]?.start);
  });

  it("returns nothing for an empty axis", () => {
    expect(layoutBands([1, 2], 0, 1)).toEqual([]);
    expect(layoutBands([], 100, 1)).toEqual([]);
  });
});

describe("stackColumn", () => {
  it("stacks to 1 when normalized, with each segment's share", () => {
    const s = stackColumn([1, 3], true);
    expect(s.map((x) => [x.start, x.end])).toEqual([
      [0, 0.25],
      [0.25, 1],
    ]);
    expect(s.map((x) => x.share)).toEqual([0.25, 0.75]);
  });

  it("stacks in value units otherwise", () => {
    const s = stackColumn([2, 5], false);
    expect(s[1]).toEqual({ start: 2, end: 7, value: 5, share: 5 / 7 });
  });

  it("is all zeros for an empty column", () => {
    expect(stackColumn([0, 0], true)).toEqual([
      { start: 0, end: 0, value: 0, share: 0 },
      { start: 0, end: 0, value: 0, share: 0 },
    ]);
  });
});

describe("labelFits / formatShare", () => {
  it("needs the padding on both sides and a minimum height", () => {
    expect(labelFits(20, 32, 14)).toBe(true);
    expect(labelFits(21, 32, 14)).toBe(false);
    expect(labelFits(20, 32, 13)).toBe(false);
  });

  it("prints whole percents and marks a sliver", () => {
    expect(formatShare(0.4249)).toBe("42%");
    expect(formatShare(0.005)).toBe("<1%");
    expect(formatShare(0)).toBe("0%");
  });
});

describe("fitBandLabels", () => {
  const wide = { start: 0, size: 100 };
  const narrow = { start: 101, size: 20 };
  const mid = { start: 122, size: 60 };
  const bands = [wide, narrow, mid];

  it("keeps labels that fit whole, ellipsizes with a title, drops the rest", () => {
    const out = fitBandLabels(
      ["Alpha", "Bravo Charlie", "Delta Echo"],
      bands,
      182,
      measure,
      ellipsize,
    );
    expect(out.map((l) => l.label)).toEqual(["Alpha", "Delta …"]);
    expect(out[1]?.title).toBe("Delta Echo");
    expect(out[0]?.position).toBeCloseTo(50 / 182);
  });

  it("keeps an endpoint with whatever ellipsis fits", () => {
    const out = fitBandLabels(
      ["Alpha", "Bravo", "Charlie"],
      [wide, mid, narrow],
      182,
      measure,
      ellipsize,
    );
    expect(out.map((l) => l.label)).toEqual(["Alpha", "Bravo", "C…"]);
  });

  it("is empty for an empty axis", () => {
    expect(fitBandLabels(["A"], bands, 0, measure, ellipsize)).toEqual([]);
  });

  it("keeps a suffix whole and ellipsizes the head, dropping the label when the suffix alone does not fit", () => {
    const out = fitBandLabels(
      ["Alpha", "Bravo Charlie", "Delta Echo"],
      bands,
      182,
      measure,
      ellipsize,
      {
        suffixes: [" 40%", " 10%", " 50%"],
      },
    );
    expect(out.map((l) => l.label)).toEqual(["Alpha 40%", "De… 50%"]);
    expect(out[1]?.title).toBe("Delta Echo 50%");
    const tight = fitBandLabels(["Alpha"], [{ start: 0, size: 30 }], 30, measure, ellipsize, {
      suffixes: [" 40%"],
    });
    expect(tight).toEqual([]);
  });
});

describe("ramp / dither", () => {
  it("steps the ramp from dark to light and the dots from dense to sparse", () => {
    expect(rampStrength(0, 3)).toBeGreaterThan(rampStrength(1, 3));
    expect(rampStrength(2, 3)).toBeCloseTo(0.14);
    expect(rampStrength(0, 1)).toBe(0.7);
    expect(ditherDots(0, 4)).toBe(15);
    expect(ditherDots(3, 4)).toBe(1);
    expect(ditherDots(0, 1)).toBe(8);
  });

  it("sets as many Bayer cells as dots", () => {
    expect(ditherCells(0)).toHaveLength(0);
    expect(ditherCells(4)).toHaveLength(4);
    expect(ditherCells(16)).toHaveLength(16);
    expect(ditherCells(1)).toEqual([{ x: 0, y: 0 }]);
  });
});

describe("indexToPx / pxToIndex", () => {
  const bands = [
    { start: 0, size: 100 },
    { start: 101, size: 50 },
  ];

  it("maps a fractional index piecewise over the bands and back", () => {
    expect(indexToPx(0.5, bands, 151)).toBe(50);
    expect(indexToPx(1.5, bands, 151)).toBe(126);
    expect(indexToPx(2, bands, 151)).toBe(151);
    expect(pxToIndex(50, bands)).toBeCloseTo(0.5);
    expect(pxToIndex(126, bands)).toBeCloseTo(1.5);
    expect(pxToIndex(100.5, bands)).toBe(1);
    expect(pxToIndex(200, bands)).toBe(2);
  });
});
