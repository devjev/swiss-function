import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { computeTicks } from "./ticks";

const rand = seededRandom(11);
const DAY = 86_400_000;
const BASE = Date.UTC(2020, 0, 1);

// Random windows spanning hours to years — the shape a Timeline mounts with,
// exercising every `formatTick` branch (year/month/week/day/hour). Each entry
// is [start, end, pxPerDay]; the tick labels are (re)formatted on every mount.
const windows = Array.from({ length: 500 }, () => {
  const spanDays = 10 ** (rand() * 3.5); // ~1 day … ~3000 days
  const start = new Date(BASE + rand() * 365 * DAY);
  const end = new Date(start.getTime() + spanDays * DAY);
  const pxPerDay = 2 + rand() * 60;
  return [start, end, pxPerDay] as const;
});

describe("Timeline computeTicks", () => {
  bench(
    "500 tick computations across scales (formats every label)",
    () => {
      for (const [start, end, pxPerDay] of windows) computeTicks(start, end, pxPerDay);
    },
    BENCH,
  );

  bench(
    "dense daily ticks over a year",
    () => {
      computeTicks(new Date(BASE), new Date(BASE + 365 * DAY), 40);
    },
    BENCH,
  );
});
