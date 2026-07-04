import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { timeTicks } from "./timeTicks";

const rand = seededRandom(7);
const BASE = 1_700_000_000_000;
const YEAR = 365.25 * 24 * 3600 * 1000;
// Random zoom windows across four orders of magnitude — the shape a zoom
// interaction produces (every wheel event recomputes ticks for a new domain).
const windows = Array.from({ length: 1000 }, () => {
  const span = 10 ** (4 + rand() * 6) * 1000; // 10⁴s … 10¹⁰s
  const start = BASE + rand() * YEAR;
  return [start, start + span] as const;
});

describe("timeTicks", () => {
  bench(
    "1k adaptive tick computations across zoom levels",
    () => {
      for (const [a, b] of windows) timeTicks(a, b, 800);
    },
    BENCH,
  );

  bench(
    "dense domain (hourly ticks over two weeks at 4k px)",
    () => {
      timeTicks(BASE, BASE + 14 * 86_400_000, 4000, 40);
    },
    BENCH,
  );
});
