import type { GridData } from "../../lib/chart3d/types";
import { Surface } from "./Surface";

function grid(n: number): GridData {
  const x: number[] = [];
  const y: number[] = [];
  const z: number[][] = [];
  for (let i = 0; i < n; i++) x.push(i);
  for (let j = 0; j < n; j++) y.push(j);
  for (let j = 0; j < n; j++) {
    const row: number[] = [];
    for (let i = 0; i < n; i++) row.push(Math.sin(i / 2) + Math.cos(j / 2));
    z.push(row);
  }
  return { x, y, z };
}

export function SurfaceHarness({ n = 6 }: { n?: number }) {
  return (
    <div style={{ width: 360 }}>
      <Surface data={grid(n)} height={240} />
    </div>
  );
}
