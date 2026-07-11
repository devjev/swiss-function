import { describe, expect, it } from "vitest";
import type { LabelBox } from "./labelLayout";
import { ellipsize, fitBandTicks, maxLabelWidth, thinLabels } from "./labelLayout";

/** Fake measurer: every glyph (including "…") is 7px wide. */
const measure = (t: string) => t.length * 7;

describe("thinLabels", () => {
  it("always keeps priority-2 endpoints, even when they mutually collide", () => {
    const boxes: LabelBox[] = [
      { center: 0, size: 100, priority: 2 },
      { center: 10, size: 100 },
      { center: 20, size: 100, priority: 2 },
    ];
    expect(thinLabels(boxes)).toEqual([true, false, true]);
  });

  it("keeps a major over an adjacent colliding minor regardless of input order", () => {
    const minorFirst: LabelBox[] = [
      { center: 0, size: 20, priority: 0 },
      { center: 10, size: 20, priority: 1 },
    ];
    expect(thinLabels(minorFirst)).toEqual([false, true]);
    const majorFirst: LabelBox[] = [
      { center: 0, size: 20, priority: 1 },
      { center: 10, size: 20, priority: 0 },
    ];
    expect(thinLabels(majorFirst)).toEqual([true, false]);
  });

  it("prefers last frame's survivor between equal minors, but never over a major", () => {
    const rivals: LabelBox[] = [
      { center: 0, size: 20, key: "a" },
      { center: 2, size: 20, key: "b" },
    ];
    // Without bias the leftmost (greedy by center) wins.
    expect(thinLabels(rivals)).toEqual([true, false]);
    // With bias the remembered minor wins over its equal rival.
    expect(thinLabels(rivals, { previousKeys: new Set(["b"]) })).toEqual([false, true]);
    // But a bumped minor still loses to a real major.
    const withMajor: LabelBox[] = [
      { center: 0, size: 20, priority: 1 },
      { center: 2, size: 20, key: "b" },
    ];
    expect(thinLabels(withMajor, { previousKeys: new Set(["b"]) })).toEqual([true, false]);
  });

  it("is deterministic: identical input yields identical flags", () => {
    const boxes: LabelBox[] = Array.from({ length: 50 }, (_, i) => ({
      center: (i * 37) % 200,
      size: 18,
      priority: i % 7 === 0 ? 1 : 0,
    }));
    const a = thinLabels(boxes);
    const b = thinLabels(boxes);
    expect(b).toEqual(a);
  });

  it("returns flags parallel to input order, not center order", () => {
    const spread: LabelBox[] = [
      { center: 100, size: 10 },
      { center: 0, size: 10 },
      { center: 50, size: 10 },
    ];
    expect(thinLabels(spread)).toEqual([true, true, true]);
    // Indices 1 and 2 collide; the survivor (center 0, greedy by center) sits
    // at input index 2 — flags must follow input positions.
    const colliding: LabelBox[] = [
      { center: 100, size: 10 },
      { center: 6, size: 10 },
      { center: 0, size: 10 },
    ];
    expect(thinLabels(colliding)).toEqual([true, false, true]);
  });

  it("treats exactly-gap spacing as clear and anything closer as a collision", () => {
    // Edges at 5 and 15 → exactly the default 10px gap apart.
    const exact: LabelBox[] = [
      { center: 0, size: 10 },
      { center: 20, size: 10 },
    ];
    expect(thinLabels(exact)).toEqual([true, true]);
    const closer: LabelBox[] = [
      { center: 0, size: 10 },
      { center: 19.9, size: 10 },
    ];
    expect(thinLabels(closer)).toEqual([true, false]);
    // A wider gap turns the previously-clear pair into a collision.
    expect(thinLabels(exact, { gapPx: 12 })).toEqual([true, false]);
  });
});

describe("ellipsize", () => {
  it("returns the text unchanged when it fits, including the exact boundary", () => {
    expect(ellipsize("hello", 35, measure)).toBe("hello"); // 5 × 7 = 35 exactly
    expect(ellipsize("hello", 100, measure)).toBe("hello");
  });

  it("finds the longest prefix that fits with an ellipsis", () => {
    // "hello world" is 77px; at 42px the best is "hello…" (6 glyphs = 42px).
    expect(ellipsize("hello world", 42, measure)).toBe("hello…");
    // One px less and the prefix shrinks by a character.
    expect(ellipsize("hello world", 41, measure)).toBe("hell…");
  });

  it("returns '' when even one glyph plus the ellipsis cannot fit", () => {
    expect(ellipsize("hello", 13, measure)).toBe(""); // "h…" needs 14px
    expect(ellipsize("hello", 0, measure)).toBe("");
  });

  it("never yields a result wider than maxPx", () => {
    for (let px = 0; px <= 90; px++) {
      const out = ellipsize("categorical", px, measure);
      expect(measure(out)).toBeLessThanOrEqual(px);
    }
  });
});

describe("fitBandTicks", () => {
  it("rung 1: keeps every label at full text when all fit their band", () => {
    const fractions = [1 / 6, 3 / 6, 5 / 6];
    const out = fitBandTicks(["aa", "bb", "cc"], fractions, 30, 90, measure);
    expect(out).toEqual([
      { label: "aa", position: 1 / 6 },
      { label: "bb", position: 3 / 6 },
      { label: "cc", position: 5 / 6 },
    ]);
  });

  it("rung 2: ellipsizes in place, title only on the truncated labels", () => {
    // Band budget 40 − 8 = 32px: "abcdef" (42px) truncates to "abc…", "ab" fits.
    const out = fitBandTicks(["abcdef", "ab"], [0.25, 0.75], 40, 80, measure);
    expect(out).toEqual([
      { label: "abc…", title: "abcdef", position: 0.25 },
      { label: "ab", position: 0.75 },
    ]);
  });

  it("rung 3: thins to a stride, keeping first and last, dropping the colliding survivor", () => {
    // Budget 20 − 8 = 12px fits nothing (even "l…" is 14px) → thin. The
    // stride is 2, so 0/2/4/6 survive; the forced last (7) collides with 6,
    // which is dropped.
    const labels = Array.from({ length: 8 }, (_, i) => `label${i}`);
    const fractions = labels.map((_, i) => (i + 0.5) / 8);
    const out = fitBandTicks(labels, fractions, 20, 160, measure);
    expect(out).toEqual([
      { label: "lab…", title: "label0", position: fractions[0] },
      { label: "lab…", title: "label2", position: fractions[2] },
      { label: "lab…", title: "label4", position: fractions[4] },
      { label: "lab…", title: "label7", position: fractions[7] },
    ]);
  });

  it("rung 3: keeps the nearest stride survivor when the last does not collide", () => {
    // Non-uniform fractions: the last center is 180px from the previous
    // survivor, well past the 40px the stride-2 bands need.
    const labels = ["label0", "label1", "label2", "label3"];
    const out = fitBandTicks(labels, [0.05, 0.2, 0.5, 0.95], 20, 400, measure);
    expect(out).toEqual([
      { label: "lab…", title: "label0", position: 0.05 },
      { label: "lab…", title: "label2", position: 0.5 },
      { label: "lab…", title: "label3", position: 0.95 },
    ]);
  });

  it("rung 3: never drops the first label even when it collides with the last", () => {
    const out = fitBandTicks(["alpha", "beta"], [0.25, 0.75], 10, 40, measure);
    expect(out).toEqual([
      { label: "alp…", title: "alpha", position: 0.25 },
      { label: "beta", position: 0.75 },
    ]);
  });

  it("honors minCh: a truncation below it falls through to thinning", () => {
    // Same input as the rung-2 case, but "abc…" (4 chars) < minCh 5 → rung 3.
    // The stride-2 budget (72px) then fits both labels in full — no titles.
    const out = fitBandTicks(["abcdef", "ab"], [0.25, 0.75], 40, 80, measure, { minCh: 5 });
    expect(out).toEqual([
      { label: "abcdef", position: 0.25 },
      { label: "ab", position: 0.75 },
    ]);
  });

  it("returns [] for empty input", () => {
    expect(fitBandTicks([], [], 20, 100, measure)).toEqual([]);
  });
});

describe("maxLabelWidth", () => {
  it("returns 0 for empty input", () => {
    expect(maxLabelWidth([], measure)).toBe(0);
  });

  it("pads then quantizes up to the step", () => {
    // "abc" = 21px + 4 pad = 25 → next multiple of 8 is 32.
    expect(maxLabelWidth(["abc"], measure)).toBe(32);
    // Exact multiples stay put: "abcd" = 28 + 4 = 32.
    expect(maxLabelWidth(["abcd"], measure)).toBe(32);
  });

  it("takes the widest label and honors custom pad/quant", () => {
    expect(maxLabelWidth(["a", "abcde"], measure)).toBe(40); // 35 + 4 = 39 → 40
    expect(maxLabelWidth(["abc"], measure, { padPx: 0, quantPx: 10 })).toBe(30); // 21 → 30
  });
});
