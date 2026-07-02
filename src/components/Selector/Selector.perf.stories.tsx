import type { Story } from "@ladle/react";
import { useState } from "react";
import { Selector } from "./Selector";

export default { title: "Perf/Selector" };

// 1000 items for the perf probes (scripts/perf/scenarios/selector.mjs):
// open-to-painted, filter keystrokes, and arrow navigation over a large,
// non-virtualized option list. Doubles as a manual stress story.

const ITEMS = Array.from(
  { length: 1_000 },
  (_, i) => `Item ${String(i).padStart(4, "0")} ${((i * 2654435761) % 1e6).toString(36)}`,
);

/** 1000 options — the perf-probe target. */
export const PerfThousand: Story = () => {
  const [value, setValue] = useState<string[]>([ITEMS[0] as string]);
  return (
    <div data-perf-ready="">
      <Selector items={ITEMS} value={value} onChange={setValue} placeholder="Filter 1000 items…" />
    </div>
  );
};
