import type { GridData } from "../../lib/chart3d/types";
import { Heatmap } from "./Heatmap";

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
}: {
  n?: number;
  contours?: number;
  showValues?: boolean;
}) {
  return (
    <div style={{ width: 360 }}>
      <Heatmap data={grid(n)} contours={contours} showValues={showValues} />
    </div>
  );
}
