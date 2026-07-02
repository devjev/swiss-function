import { bench, describe } from "vitest";
import { BENCH } from "../../../perf/benchOptions";
import { redistribute, splitTracks, tokenizeTemplate } from "./Grid";

// 50 mixed tracks: fr / px / minmax() / auto — the worst realistic template.
const template = Array.from({ length: 50 }, (_, i) =>
  i % 4 === 0
    ? "minmax(48px, 1fr)"
    : i % 4 === 1
      ? `${80 + i}px`
      : i % 4 === 2
        ? "auto"
        : `${(i % 3) + 1}fr`,
).join(" ");
const pxTracks = Array.from({ length: 50 }, (_, i) => 60 + (i % 7) * 20);

describe("Grid track math", () => {
  bench(
    "splitTracks on a 50-track mixed template",
    () => {
      splitTracks(template);
    },
    BENCH,
  );

  bench(
    "tokenizeTemplate string + array forms",
    () => {
      tokenizeTemplate(template);
      tokenizeTemplate([200, 1, "auto", "minmax(48px, 1fr)", 2]);
    },
    BENCH,
  );

  bench(
    "redistribute across a 50-track px array (5 gutters)",
    () => {
      for (const at of [0, 12, 24, 36, 48]) redistribute(pxTracks, at, 16, 48);
    },
    BENCH,
  );
});
