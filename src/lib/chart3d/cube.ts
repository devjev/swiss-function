/** The axonometric bounding-box frame + axis ticks for the 3D charts. Pure. */

import { niceTicks } from "../chart/numericTicks";
import { normalize } from "./projection";
import type { Domain } from "./types";

export type Vec3 = readonly [number, number, number];

/** The 12 edges of the centered unit cube as pairs of corners. */
export const CUBE_EDGES: ReadonlyArray<readonly [Vec3, Vec3]> = (() => {
  const c: Vec3[] = [
    [-0.5, -0.5, -0.5],
    [0.5, -0.5, -0.5],
    [0.5, 0.5, -0.5],
    [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5],
    [0.5, -0.5, 0.5],
    [0.5, 0.5, 0.5],
    [-0.5, 0.5, 0.5],
  ];
  const pairs: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0], // bottom
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4], // top
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7], // verticals
  ];
  // biome-ignore lint/style/noNonNullAssertion: indices are in-range by construction
  return pairs.map(([a, b]) => [c[a]!, c[b]!] as const);
})();

export interface AxisTick {
  /** Normalized position of this tick along its axis, in [-0.5, 0.5]. */
  n: number;
  label: string;
}

/** Nice ticks for one axis, as normalized positions + labels. */
export function axisTicks(domain: Domain, target = 5): AxisTick[] {
  return niceTicks(domain[0], domain[1], target)
    .filter((t) => t.value >= domain[0] && t.value <= domain[1])
    .map((t) => ({ n: normalize(t.value, domain), label: t.label }));
}
