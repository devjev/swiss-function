import { useState } from "react";
import { HorizonChart, type HorizonChartProps, type HorizonPoint } from "./HorizonChart";

/** A HorizonChart that reports its last activation and its pinned selection. */
export function ActivatableHorizon(props: Omit<HorizonChartProps, "onPointActivate">) {
  const [activated, setActivated] = useState<HorizonPoint | null>(null);
  const [selection, setSelection] = useState<HorizonPoint | null>(null);
  return (
    <div style={{ width: 480 }}>
      <HorizonChart
        {...props}
        onPointActivate={setActivated}
        selection={selection}
        onSelectionChange={setSelection}
      />
      <div data-testid="activated">{activated ? `${activated.series}:${activated.y}` : ""}</div>
      <div data-testid="selection">{selection ? `${selection.series}:${selection.y}` : ""}</div>
    </div>
  );
}
