import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import type { GridData } from "../../lib/chart3d/types";
import { Heatmap, type HeatmapProps } from "./Heatmap";

function grid(n: number): GridData {
  const x: number[] = [];
  const y: number[] = [];
  const z: number[][] = [];
  for (let i = 0; i < n; i++) x.push(i);
  for (let j = 0; j < n; j++) y.push(j);
  for (let j = 0; j < n; j++) {
    const row: number[] = [];
    for (let i = 0; i < n; i++) row.push(i + j);
    z.push(row);
  }
  return { x, y, z };
}

export function HeatmapHarness({
  n = 8,
  contours,
  showValues,
  editable,
  onChange,
  annotations: initial,
  ...props
}: {
  n?: number;
  contours?: number;
  showValues?: boolean;
  editable?: boolean;
  onChange?: (next: ChartAnnotation[]) => void;
} & Omit<HeatmapProps, "data" | "contours" | "showValues" | "onAnnotationsChange">) {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>(initial ?? []);
  return (
    <div style={{ width: 360 }}>
      <Heatmap
        {...props}
        data={grid(n)}
        contours={contours}
        showValues={showValues}
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
