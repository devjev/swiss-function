import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { bandScale, linearScale, timeScale } from "./scales";

const rand = seededRandom(2);
const points = Array.from({ length: 100_000 }, () => rand() * 1000);
const dates = points.map((p) => new Date(1_700_000_000_000 + p * 86_400_000));
const categories = Array.from({ length: 1_000 }, (_, i) => `category-${i}`);

describe("scales", () => {
  bench(
    "linearScale maps 100k points",
    () => {
      const scale = linearScale([0, 1000], [0, 640]);
      for (const p of points) scale(p);
    },
    BENCH,
  );

  bench(
    "timeScale maps 100k dates",
    () => {
      const scale = timeScale([dates[0] as Date, dates[dates.length - 1] as Date], [0, 640]);
      for (const d of dates) scale(d);
    },
    BENCH,
  );

  bench(
    "bandScale construction + 100k lookups over 1k categories",
    () => {
      const scale = bandScale(categories, [0, 640]);
      for (let i = 0; i < 100_000; i++) scale.position(categories[i % categories.length] as string);
    },
    BENCH,
  );
});
