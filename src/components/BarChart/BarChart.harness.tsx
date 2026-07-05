import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { BarChart, type BarChartProps } from "./BarChart";

/** Playwright CT mounts top-level components with serializable props, so the
 *  annotation round-trip (draw → onAnnotationsChange → re-render) needs a
 *  stateful owner. `editable` wires editing and mirrors each commit to the
 *  test via `onChange`; without it the chart is read-only. */
export function BarChartScaffoldHarness({
  editable,
  onChange,
  annotations: initial,
  ...props
}: Omit<BarChartProps, "onAnnotationsChange"> & {
  editable?: boolean;
  onChange?: (next: ChartAnnotation[]) => void;
}) {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>(initial ?? []);
  return (
    <div style={{ width: 480 }}>
      <BarChart
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
