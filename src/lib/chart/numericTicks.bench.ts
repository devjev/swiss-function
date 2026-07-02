import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { formatNumber, niceDomain, niceTicks } from "./numericTicks";

const rand = seededRandom(1);
const domains: [number, number][] = Array.from({ length: 1_000 }, () => {
  const a = (rand() - 0.5) * 1e6;
  const b = a + rand() * 1e6 + 1e-6;
  return [a, b];
});
const values = Array.from({ length: 10_000 }, () => (rand() - 0.5) * 1e5);
const tickValues = niceTicks(-12345.678, 98765.432, 6).map((t) => t.value);

describe("numericTicks", () => {
  bench(
    "niceTicks over 1k random domains",
    () => {
      for (const [min, max] of domains) niceTicks(min, max, 6);
    },
    BENCH,
  );

  bench(
    "niceDomain on 10k values",
    () => {
      niceDomain(values, 5);
    },
    BENCH,
  );

  bench(
    "formatNumber over a tick sweep ×1k",
    () => {
      for (let i = 0; i < 1_000; i++) {
        for (const v of tickValues) formatNumber(v);
      }
    },
    BENCH,
  );
});
