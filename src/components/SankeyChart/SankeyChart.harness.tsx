import { useState } from "react";
import { SankeyChart, type SankeyChartProps, type SankeyDatum } from "./SankeyChart";

/** A fixed-width owner for CT: logs activations and, when `controlled`, owns
 *  the pinned selection so the spec can read it back. */
export function SankeyHarness({
  controlled,
  width = 640,
  ...props
}: SankeyChartProps & { controlled?: boolean; width?: number }) {
  const [log, setLog] = useState<string[]>([]);
  const [selection, setSelection] = useState<SankeyDatum | null>(null);
  const describe = (d: SankeyDatum) =>
    d.kind === "node" ? `node:${d.id}` : `link:${d.source}>${d.target}`;
  return (
    <div style={{ width }}>
      <SankeyChart
        {...props}
        onPointActivate={(d) => {
          setLog((l) => [...l, describe(d)]);
          props.onPointActivate?.(d);
        }}
        {...(controlled ? { selectable: true, selection, onSelectionChange: setSelection } : {})}
      />
      <div data-testid="log">{log.join(",")}</div>
      <div data-testid="selection">{selection ? describe(selection) : "none"}</div>
    </div>
  );
}
