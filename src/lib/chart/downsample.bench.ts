import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { lttb, minMaxDownsample, sliceRange } from "./downsample";

interface Point {
  x: number;
  y: number;
}

const rand = seededRandom(7);
const series: Point[] = Array.from({ length: 1_000_000 }, (_, i) => ({ x: i, y: rand() * 1000 }));
const getX = (p: Point) => p.x;
const getY = (p: Point) => p.y;

describe("downsample", () => {
  bench(
    "minMaxDownsample 1M points → 1000 buckets",
    () => {
      minMaxDownsample(series, getX, getY, 1000);
    },
    BENCH,
  );

  bench(
    "lttb 1M points → 1000 points",
    () => {
      lttb(series, getX, getY, 1000);
    },
    BENCH,
  );

  bench(
    "sliceRange 10k lookups over 1M points",
    () => {
      for (let i = 0; i < 10_000; i++) sliceRange(series, getX, i * 50, i * 50 + 10_000);
    },
    BENCH,
  );
});
