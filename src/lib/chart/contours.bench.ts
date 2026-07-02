import { bench, describe } from "vitest";
import { BENCH, seededRandom } from "../../../perf/benchOptions";
import { contourLevels, marchingSquares } from "./contours";

function makeGrid(n: number, seed: number): number[][] {
  const rand = seededRandom(seed);
  // Smooth-ish field (sum of sines + noise) so iso-lines actually exist.
  return Array.from({ length: n }, (_, y) =>
    Array.from(
      { length: n },
      (_, x) => Math.sin(x / 7) * Math.cos(y / 9) + Math.sin((x + y) / 13) + rand() * 0.2,
    ),
  );
}

const grid100 = makeGrid(100, 3);
const grid200 = makeGrid(200, 4);
const levels = contourLevels(-2.2, 2.2, 5);

describe("contours (Heatmap hot path)", () => {
  bench(
    "marchingSquares 100×100 × 5 levels",
    () => {
      for (const level of levels) marchingSquares(grid100, level);
    },
    BENCH,
  );

  bench(
    "marchingSquares 200×200 × 5 levels",
    () => {
      for (const level of levels) marchingSquares(grid200, level);
    },
    BENCH,
  );
});
