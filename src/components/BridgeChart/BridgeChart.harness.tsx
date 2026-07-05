import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { BridgeChart, type BridgeChartProps } from "./BridgeChart";

/** Stateful owner for the annotation round-trip in CT (see BarChart.harness). */
export function BridgeChartScaffoldHarness({
  editable,
  onChange,
  annotations: initial,
  ...props
}: Omit<BridgeChartProps, "onAnnotationsChange"> & {
  editable?: boolean;
  onChange?: (next: ChartAnnotation[]) => void;
}) {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>(initial ?? []);
  return (
    <div style={{ width: 480 }}>
      <BridgeChart
        {...props}
        annotations={editable ? annotations : initial}
        onAnnotationsChange={
          editable
            ? (next) => {
                setAnnotations(next);
                onChange?.(next);
              }
            : undefined
        }
      />
    </div>
  );
}
