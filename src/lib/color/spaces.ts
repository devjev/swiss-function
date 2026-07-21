// The colour-space registry. Each space lists its channels in display units —
// the same units the sliders and numeric fields show and that `convert` reads.

export type SpaceId = "oklch" | "oklab" | "rgb" | "hsl" | "hsv" | "lch" | "lab";

export interface ChannelDef {
  /** Short key (`l`, `c`, `h`, `r`, `a`, …). */
  key: string;
  /** Display label. */
  label: string;
  min: number;
  max: number;
  /** Slider/spinner step. */
  step: number;
  /** Decimal places for the numeric field. */
  decimals: number;
  /** Suffix, e.g. `°` or `%`. */
  unit?: string;
  /** True for a hue channel (wraps 0..360; gets a rainbow track). */
  hue?: boolean;
}

export interface SpaceDef {
  id: SpaceId;
  label: string;
  channels: ChannelDef[];
}

const HUE: ChannelDef = {
  key: "h",
  label: "H",
  min: 0,
  max: 360,
  step: 1,
  decimals: 0,
  unit: "°",
  hue: true,
};
const PCT = (key: string, label: string): ChannelDef => ({
  key,
  label,
  min: 0,
  max: 100,
  step: 1,
  decimals: 0,
  unit: "%",
});

export const SPACES: Record<SpaceId, SpaceDef> = {
  oklch: {
    id: "oklch",
    label: "OKLCH",
    channels: [
      { key: "l", label: "L", min: 0, max: 1, step: 0.005, decimals: 3 },
      { key: "c", label: "C", min: 0, max: 0.4, step: 0.005, decimals: 3 },
      HUE,
    ],
  },
  oklab: {
    id: "oklab",
    label: "OKLab",
    channels: [
      { key: "l", label: "L", min: 0, max: 1, step: 0.005, decimals: 3 },
      { key: "a", label: "a", min: -0.4, max: 0.4, step: 0.005, decimals: 3 },
      { key: "b", label: "b", min: -0.4, max: 0.4, step: 0.005, decimals: 3 },
    ],
  },
  rgb: {
    id: "rgb",
    label: "RGB",
    channels: [
      { key: "r", label: "R", min: 0, max: 255, step: 1, decimals: 0 },
      { key: "g", label: "G", min: 0, max: 255, step: 1, decimals: 0 },
      { key: "b", label: "B", min: 0, max: 255, step: 1, decimals: 0 },
    ],
  },
  hsl: { id: "hsl", label: "HSL", channels: [HUE, PCT("s", "S"), PCT("l", "L")] },
  hsv: { id: "hsv", label: "HSV", channels: [HUE, PCT("s", "S"), PCT("v", "V")] },
  lch: {
    id: "lch",
    label: "LCH",
    channels: [
      { key: "l", label: "L", min: 0, max: 100, step: 0.5, decimals: 1 },
      { key: "c", label: "C", min: 0, max: 150, step: 0.5, decimals: 1 },
      HUE,
    ],
  },
  lab: {
    id: "lab",
    label: "Lab",
    channels: [
      { key: "l", label: "L", min: 0, max: 100, step: 0.5, decimals: 1 },
      { key: "a", label: "a", min: -125, max: 125, step: 0.5, decimals: 1 },
      { key: "b", label: "b", min: -125, max: 125, step: 0.5, decimals: 1 },
    ],
  },
};

export const SPACE_IDS: SpaceId[] = ["oklch", "oklab", "rgb", "hsl", "hsv", "lch", "lab"];

/** Index of the hue channel in a space, or -1 if it has none. */
export function hueIndex(space: SpaceId): number {
  return SPACES[space].channels.findIndex((c) => c.hue);
}
