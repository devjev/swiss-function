import type { Story } from "@ladle/react";
import { useState } from "react";
import { Picker } from "./Picker";

export default { title: "Perf/Picker" };

// 1000 items for the perf probes (scripts/perf/scenarios/picker.mjs):
// open-to-painted, filter keystrokes, backspace-to-full-list, and arrow
// navigation over a large option list. Doubles as a manual stress story.
// Same deterministic generator as Selector.perf.stories.tsx.

const ITEMS = Array.from(
  { length: 1_000 },
  (_, i) => `Item ${String(i).padStart(4, "0")} ${((i * 2654435761) % 1e6).toString(36)}`,
);

/** 1000 options — the perf-probe target. Starts unselected: a selected value
 *  fills the single-select field with its label, which would skew the
 *  filter-keystroke metrics (typing appends to the label). */
export const PerfThousand: Story = () => {
  const [value, setValue] = useState<string>("");
  return (
    <div data-perf-ready="">
      <Picker items={ITEMS} value={value} onChange={setValue} placeholder="Filter 1000 items…" />
    </div>
  );
};
