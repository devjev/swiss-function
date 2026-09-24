import { useState } from "react";
import { PieChart, type PieChartProps, type PieDatum } from "./PieChart";

/** A fixed-width owner for CT: logs activations and, when `controlled`, owns
 *  the pinned selection so the spec can read it back.
 *
 *  Render-time function props (`valueFormat`, `categoryFormat`, `center`) are
 *  built here rather than passed in by the spec: Playwright CT hands a function
 *  prop across its bridge as an async handle, which returns `undefined` when a
 *  render calls it. Flags pick them instead. */
export function PieHarness({
  controlled,
  formatted,
  centerSlot,
  width = 520,
  ...props
}: PieChartProps & {
  controlled?: boolean;
  formatted?: boolean;
  centerSlot?: boolean;
  width?: number;
}) {
  const [log, setLog] = useState<string[]>([]);
  const [selection, setSelection] = useState<PieDatum | null>(null);
  return (
    <div style={{ width }}>
      <PieChart
        {...props}
        onPointActivate={(d) => {
          setLog((l) => [...l, d.name]);
          props.onPointActivate?.(d);
        }}
        {...(formatted
          ? {
              valueFormat: (v: number) => `CHF ${v}k`,
              categoryFormat: (name: string) => name.toLowerCase(),
            }
          : {})}
        {...(centerSlot
          ? {
              center: (focused: PieDatum | null) => (
                <span data-testid="centre">{focused ? focused.name : "Total"}</span>
              ),
            }
          : {})}
        {...(controlled ? { selectable: true, selection, onSelectionChange: setSelection } : {})}
      />
      <div data-testid="log">{log.join(",")}</div>
      <div data-testid="selection">{selection ? selection.name : "none"}</div>
    </div>
  );
}
