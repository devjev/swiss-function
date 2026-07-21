// Build CSS gradient strings for the channel-slider tracks. Each stop is sampled
// in the space, gamut-mapped, and emitted as an sRGB hex so the ramp renders
// identically in every browser (no reliance on CSS oklch interpolation).

import { channelsToSrgb, srgbToHex } from "./convert";
import { clipSrgb } from "./gamut";
import { SPACES, type SpaceId } from "./spaces";

// A hue slider at the current (possibly grey) chroma would be a dull grey ramp,
// so hue tracks use a fixed, vivid representative for the other channels — the
// track always reads as a full rainbow.
const HUE_BASE: Record<SpaceId, number[]> = {
  hsl: [0, 100, 50],
  hsv: [0, 100, 100],
  oklch: [0.7, 0.15, 0],
  lch: [65, 65, 0],
  oklab: [0.7, 0, 0],
  lab: [65, 0, 0],
  rgb: [255, 0, 0],
};

/**
 * A `linear-gradient(...)` previewing what `channelIndex` does across its range,
 * holding the other channels at their current values (hue tracks use a vivid
 * representative so they read as a rainbow).
 */
export function channelGradient(space: SpaceId, channels: number[], channelIndex: number): string {
  const def = SPACES[space].channels[channelIndex];
  if (!def) return "none";
  const base = def.hue ? HUE_BASE[space] : channels;
  const steps = def.hue ? 24 : 12;
  const stops: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ch = base.slice();
    ch[channelIndex] = def.min + t * (def.max - def.min);
    stops.push(`${srgbToHex(clipSrgb(channelsToSrgb(space, ch)))} ${Math.round(t * 100)}%`);
  }
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

/** An alpha track: the opaque colour fading to transparent (over a checkerboard,
 *  supplied by the consumer's CSS). `hex` is an opaque `#rrggbb`. */
export function alphaGradient(hex: string): string {
  const base = hex.slice(0, 7);
  return `linear-gradient(to right, ${base}00, ${base}ff)`;
}
