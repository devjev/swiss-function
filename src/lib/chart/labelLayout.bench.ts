import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import type { LabelBox } from "./labelLayout";
import { fitBandTicks, thinLabels } from "./labelLayout";

const rand = seededRandom(62);

const boxes: LabelBox[] = Array.from({ length: 1_000 }, (_, i) => ({
  center: rand() * 10_000,
  size: 20 + rand() * 60,
  priority: i === 0 || i === 999 ? 2 : i % 10 === 0 ? 1 : 0,
  key: `k${i}`,
}));
const previousKeys = new Set(boxes.filter(() => rand() < 0.5).map((b) => b.key ?? ""));

const alphabet = "abcdefghijklmnopqrstuvwxyz";
const labels = Array.from({ length: 200 }, () => {
  const length = 4 + Math.floor(rand() * 16);
  let s = "";
  for (let i = 0; i < length; i++) s += alphabet[Math.floor(rand() * 26)];
  return s;
});
const centers = labels.map((_, i) => (i + 0.5) / labels.length);
const measure = (t: string) => t.length * 7;

describe("labelLayout", () => {
  bench(
    "thinLabels over 1k boxes with survivor bias",
    () => {
      thinLabels(boxes, { previousKeys });
    },
    BENCH,
  );

  bench(
    "fitBandTicks over 200 categories (thinning rung)",
    () => {
      fitBandTicks(labels, centers, 24, 4_800, measure);
    },
    BENCH,
  );
});
