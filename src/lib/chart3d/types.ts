/** Shared data shapes for the 3D / 2.5D charts (Surface, PointCloud, Heatmap). */

/** A regular grid of z values over x and y axes. `z[j][i]` is the height at
 *  `x[i]`, `y[j]` — so `z.length === y.length` and every `z[j].length === x.length`.
 *  Named `GridData` to avoid colliding with the `Grid` layout component. */
export interface GridData {
  x: number[];
  y: number[];
  z: number[][];
}

/** One point in a 3D scatter / point cloud. */
export interface Point3 {
  x: number;
  y: number;
  z: number;
  /** Optional label surfaced in the hover tooltip. */
  label?: string;
}

/** A named series of 3D points (mirrors the 2D charts' series shape). */
export interface PointSeries {
  name: string;
  data: Point3[];
  /** Override the series color (defaults to the chart palette). */
  color?: string;
}

/** Inclusive numeric range `[min, max]`. */
export type Domain = [number, number];
