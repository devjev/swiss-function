import { bench, describe } from "vitest";
import { BENCH } from "../../../perf/benchOptions";
import type { StripModel } from "./layout";
import { moveByKey, neighbor, projectMove, rowTrack, subrowCount } from "./layout";

// 50 columns × 3 windows — far beyond any realistic strip.
const model: StripModel = {
  columns: Array.from({ length: 50 }, (_, c) => ({
    id: `col-${c}`,
    windowIds: Array.from({ length: 3 }, (_, w) => `w-${c}-${w}`),
  })),
};
const allIds = model.columns.flatMap((c) => c.windowIds);
const counts = model.columns.map((c) => c.windowIds.length);

describe("WindowArray layout (50 columns × 3 windows)", () => {
  bench(
    "projectMove for every drop-slot kind on every window",
    () => {
      for (const id of allIds) {
        projectMove(model, id, { kind: "cell", columnId: "col-25", index: 1 });
        projectMove(model, id, { kind: "column", index: 25 });
      }
    },
    BENCH,
  );

  bench(
    "neighbor full navigation sweep (4 directions × all windows)",
    () => {
      for (const id of allIds) {
        neighbor(model, id, "up");
        neighbor(model, id, "down");
        neighbor(model, id, "left");
        neighbor(model, id, "right");
      }
    },
    BENCH,
  );

  bench(
    "moveByKey worst case (all windows × 4 directions)",
    () => {
      for (const id of allIds) {
        moveByKey(model, id, "up");
        moveByKey(model, id, "down");
        moveByKey(model, id, "left");
        moveByKey(model, id, "right");
      }
    },
    BENCH,
  );

  bench(
    "subrowCount + rowTrack for the whole strip",
    () => {
      const subrows = subrowCount(counts);
      for (const count of counts) {
        for (let i = 0; i < count; i++) rowTrack(i, count, subrows);
      }
    },
    BENCH,
  );
});
