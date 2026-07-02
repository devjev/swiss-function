import type { Story } from "@ladle/react";
import { useState } from "react";
import type { WindowMove } from "./WindowArray";
import { WindowArray } from "./WindowArray";
import { applyWindowMove } from "./WindowArray.harness";

export default { title: "Perf/WindowArray" };

// 12 columns × 4-5 windows (~50) for the perf probes (scripts/perf/scenarios/
// windowarray.mjs): drag-rearrange loops, keyboard moves, gutter resizes at a
// scale well beyond normal use. Doubles as a manual stress story.

interface PerfColumn {
  id: string;
  windows: { id: string; title: string }[];
}

function seedColumns(): PerfColumn[] {
  return Array.from({ length: 12 }, (_, c) => ({
    id: `col-${c + 1}`,
    windows: Array.from({ length: c % 2 === 0 ? 4 : 5 }, (_, w) => ({
      id: `w-${c + 1}-${w + 1}`,
      title: `Window ${c + 1}.${w + 1}`,
    })),
  }));
}

/** ~54 windows across 12 columns — the perf-probe target. */
export const PerfStrip: Story = () => {
  const [columns, setColumns] = useState(seedColumns);
  const move = (m: WindowMove) => setColumns((cols) => applyWindowMove(cols, m));
  return (
    <div style={{ blockSize: 520 }} data-perf-ready="">
      <WindowArray aria-label="Perf strip" onWindowMove={move} defaultActiveId="w-1-1">
        {columns.map((col) => (
          <WindowArray.Column key={col.id} id={col.id} defaultWidth={280}>
            {col.windows.map((win) => (
              <WindowArray.Window key={win.id} id={win.id} title={win.title}>
                <p style={{ margin: 8 }}>{win.title}</p>
              </WindowArray.Window>
            ))}
          </WindowArray.Column>
        ))}
      </WindowArray>
    </div>
  );
};
