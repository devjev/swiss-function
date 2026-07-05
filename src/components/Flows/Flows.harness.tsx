import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { Flows, type FlowsProps } from "./Flows";

/** Stateful owner for the annotation round-trip in CT (see BarChart.harness). */
export function FlowsScaffoldHarness({
  editable,
  onChange,
  annotations: initial,
  ...props
}: Omit<FlowsProps, "onAnnotationsChange"> & {
  editable?: boolean;
  onChange?: (next: ChartAnnotation[]) => void;
}) {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>(initial ?? []);
  return (
    <div style={{ width: 520 }}>
      <Flows
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
