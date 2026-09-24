import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { BarChart, type BarChartProps } from "./BarChart";

/** Playwright CT mounts top-level components with serializable props, so the
 *  annotation round-trip (draw → onAnnotationsChange → re-render) needs a
 *  stateful owner. `editable` wires editing and mirrors each commit to the
 *  test via `onChange`; without it the chart is read-only. */
export function BarChartScaffoldHarness({
  editable,
  formatted,
  onChange,
  annotations: initial,
  ...props
}: Omit<BarChartProps, "onAnnotationsChange"> & {
  editable?: boolean;
  /** Wire the label formatters here rather than passing them in: Playwright CT
   *  hands a function prop across its bridge as an async handle, which returns
   *  `undefined` when a render calls it. */
  formatted?: boolean;
  onChange?: (next: ChartAnnotation[]) => void;
}) {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>(initial ?? []);
  return (
    <div style={{ width: 480 }}>
      <BarChart
        {...props}
        {...(formatted
          ? {
              categoryFormat: (c: string) => `${c} 2026`,
              seriesFormat: (n: string, i: number) => `${i + 1}. ${n.toUpperCase()}`,
              valueFormat: (v: number) => `CHF ${v}`,
            }
          : {})}
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
