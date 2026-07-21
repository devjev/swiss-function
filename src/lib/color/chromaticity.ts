// CIE 1931 xy chromaticity: the spectral locus (the "horseshoe" of monochromatic
// light), the sRGB gamut primaries + white point, and a colour → xy helper. Used
// by ColorPicker's chromaticity diagram.

import { channelsToSrgb, srgbToXy } from "./convert";
import type { SpaceId } from "./spaces";

/**
 * CIE 1931 2° spectral locus, xy at ~10 nm (5 nm through the blue-green bend),
 * 380→700 nm. Drawn as a closed polygon: the last→first edge is the line of
 * purples that closes the horseshoe.
 */
export const SPECTRAL_LOCUS: readonly (readonly [number, number])[] = [
  [0.1741, 0.005],
  [0.1738, 0.0049],
  [0.1733, 0.0048],
  [0.1726, 0.0048],
  [0.1714, 0.0051],
  [0.1689, 0.0069],
  [0.1644, 0.0109],
  [0.1566, 0.0177],
  [0.144, 0.0297],
  [0.1241, 0.0578],
  [0.0913, 0.1327],
  [0.0687, 0.2007],
  [0.0454, 0.295],
  [0.0235, 0.4127],
  [0.0082, 0.5384],
  [0.0039, 0.6548],
  [0.0139, 0.7502],
  [0.0389, 0.812],
  [0.0743, 0.8338],
  [0.1142, 0.8262],
  [0.1547, 0.8059],
  [0.1929, 0.7816],
  [0.2296, 0.7543],
  [0.2658, 0.7243],
  [0.3016, 0.6923],
  [0.3373, 0.6589],
  [0.3731, 0.6245],
  [0.4087, 0.5896],
  [0.4441, 0.5547],
  [0.4788, 0.5202],
  [0.5125, 0.4866],
  [0.5448, 0.4544],
  [0.5752, 0.4242],
  [0.6029, 0.3965],
  [0.627, 0.3725],
  [0.6658, 0.334],
  [0.6915, 0.3083],
  [0.7079, 0.292],
  [0.719, 0.2809],
  [0.726, 0.274],
  [0.73, 0.27],
  [0.7334, 0.2666],
  [0.7347, 0.2653],
];

/** sRGB primary chromaticities (R, G, B) — the gamut triangle vertices. */
export const SRGB_PRIMARIES: readonly [
  readonly [number, number],
  readonly [number, number],
  readonly [number, number],
] = [
  [0.64, 0.33],
  [0.3, 0.6],
  [0.15, 0.06],
];

/** sRGB white point (D65). */
export const SRGB_WHITE: readonly [number, number] = [0.3127, 0.329];

/** CIE 1931 xy chromaticity of a colour, or `null` for black. Wide-gamut colours
 *  plot outside the sRGB triangle. */
export function xyOf(space: SpaceId, channels: number[]): [number, number] | null {
  return srgbToXy(channelsToSrgb(space, channels));
}

/** Whether an xy point lies inside the spectral locus (the horseshoe). Ray-cast
 *  point-in-polygon — used to mask a filled chromaticity diagram to its shape. */
export function inSpectralLocus(x: number, y: number): boolean {
  const pts = SPECTRAL_LOCUS;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const p = pts[i];
    const q = pts[j];
    if (!p || !q) continue;
    if (p[1] > y !== q[1] > y && x < ((q[0] - p[0]) * (y - p[1])) / (q[1] - p[1]) + p[0]) {
      inside = !inside;
    }
  }
  return inside;
}
