import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { clearTextMeasureCache, getTextMeasurer } from "./textMeasure";

// Node bench has no canvas, so both cases run the estimator; the comparison
// documents what the per-(font, text) cache buys over recomputing every call.

const rand = seededRandom(62);
const CHARS = "0123456789.,-kM%";
const labels = Array.from({ length: 256 }, () => {
  const len = 1 + Math.floor(rand() * 11);
  let s = "";
  for (let i = 0; i < len; i++) s += CHARS.charAt(Math.floor(rand() * CHARS.length));
  return s;
});
const FONT = "400 14px monospace";

describe("textMeasure", () => {
  bench(
    "cached measurer over 256 labels ×100",
    () => {
      const measure = getTextMeasurer(FONT);
      for (let i = 0; i < 100; i++) {
        for (const label of labels) measure(label);
      }
    },
    BENCH,
  );

  bench(
    "fresh measurer (cache cleared) over 256 labels ×100",
    () => {
      for (let i = 0; i < 100; i++) {
        clearTextMeasureCache();
        const measure = getTextMeasurer(FONT);
        for (const label of labels) measure(label);
      }
    },
    BENCH,
  );
});
