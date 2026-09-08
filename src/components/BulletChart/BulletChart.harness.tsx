import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { BulletChart, type BulletChartProps } from "./BulletChart";

/** Playwright CT mounts top-level components with serializable props, so the
 *  annotation round-trip (draw, onAnnotationsChange, re-render) needs a
 *  stateful owner. `editable` wires editing and mirrors each commit to the
 *  test via `onChange`; without it the chart is read-only. */
export function BulletChartHarness({
  editable,
  onChange,
  annotations: initial,
  width = 480,
  ...props
}: Omit<BulletChartProps, "onAnnotationsChange"> & {
  editable?: boolean;
  onChange?: (next: ChartAnnotation[]) => void;
  width?: number;
}) {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>(initial ?? []);
  return (
    <div style={{ width }}>
      <BulletChart
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
