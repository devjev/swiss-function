/** Marching-squares iso-line extraction for a regular grid. Pure — no DOM.
 *  Returns line segments in grid coordinates (x along columns, y along rows). */

export interface ContourSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type Edge = "T" | "R" | "B" | "L";

// Corner bits: tl=1, tr=2, br=4, bl=8. Each case lists the edge pair(s) the
// iso-line crosses. Saddles (5, 10) emit two segments.
const CASES: Record<number, [Edge, Edge][]> = {
  1: [["L", "T"]],
  2: [["T", "R"]],
  3: [["L", "R"]],
  4: [["R", "B"]],
  5: [
    ["L", "T"],
    ["R", "B"],
  ],
  6: [["T", "B"]],
  7: [["L", "B"]],
  8: [["L", "B"]],
  9: [["T", "B"]],
  10: [
    ["T", "R"],
    ["L", "B"],
  ],
  11: [["R", "B"]],
  12: [["L", "R"]],
  13: [["T", "R"]],
  14: [["L", "T"]],
};

/** Fraction along an edge where `level` is crossed (0.5 if the corners tie). */
function lerpT(a: number, b: number, level: number): number {
  const d = b - a;
  return d === 0 ? 0.5 : (level - a) / d;
}

/** Evenly spaced levels strictly inside [min, max], or the explicit list. */
export function contourLevels(min: number, max: number, levels: number | number[]): number[] {
  if (Array.isArray(levels)) return levels.filter((l) => l > min && l < max);
  const n = Math.max(0, Math.floor(levels));
  const out: number[] = [];
  for (let k = 1; k <= n; k++) out.push(min + ((max - min) * k) / (n + 1));
  return out;
}

/** Iso-line segments for `z` at `level`, in grid coordinates. */
export function marchingSquares(z: number[][], level: number): ContourSegment[] {
  const ny = z.length;
  if (ny < 2) return [];
  const nx = z[0]?.length ?? 0;
  if (nx < 2) return [];
  const segs: ContourSegment[] = [];

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const tl = z[j]?.[i] ?? 0;
      const tr = z[j]?.[i + 1] ?? 0;
      const br = z[j + 1]?.[i + 1] ?? 0;
      const bl = z[j + 1]?.[i] ?? 0;
      const code =
        (tl >= level ? 1 : 0) |
        (tr >= level ? 2 : 0) |
        (br >= level ? 4 : 0) |
        (bl >= level ? 8 : 0);
      const pairs = CASES[code];
      if (!pairs) continue; // 0 and 15: no crossing

      const point = (edge: Edge): [number, number] => {
        switch (edge) {
          case "T":
            return [i + lerpT(tl, tr, level), j];
          case "R":
            return [i + 1, j + lerpT(tr, br, level)];
          case "B":
            return [i + lerpT(bl, br, level), j + 1];
          default:
            return [i, j + lerpT(tl, bl, level)];
        }
      };
      for (const [ea, eb] of pairs) {
        const [x1, y1] = point(ea);
        const [x2, y2] = point(eb);
        segs.push({ x1, y1, x2, y2 });
      }
    }
  }
  return segs;
}
