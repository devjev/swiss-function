// sRGB gamut checks + mapping. Out-of-gamut is possible only from the perceptual
// spaces (OKLCH/OKLab/LCH/Lab); we reduce chroma in OKLCH until the colour fits
// sRGB (the CSS Color 4 approach), which keeps hue and lightness stable.

import { channelsToSrgb, clamp01, type Srgb, srgbToChannels } from "./convert";
import { hueIndex, type SpaceId } from "./spaces";

const GAMUT_EPS = 1e-4;

export function srgbInGamut(srgb: Srgb, eps = GAMUT_EPS): boolean {
  return srgb.every((c) => c >= -eps && c <= 1 + eps);
}

export function clipSrgb(srgb: Srgb): Srgb {
  return [clamp01(srgb[0]), clamp01(srgb[1]), clamp01(srgb[2])];
}

/** Whether a space's channels land inside the sRGB gamut. */
export function channelsInGamut(space: SpaceId, ch: number[]): boolean {
  return srgbInGamut(channelsToSrgb(space, ch));
}

const hueOf = (space: SpaceId, ch: number[]): number | undefined => {
  const i = hueIndex(space);
  return i >= 0 ? ch[i] : undefined;
};

/**
 * Return channels (in the same space) whose colour is inside sRGB. If already in
 * gamut, returns a copy unchanged. Otherwise reduces chroma in OKLCH via binary
 * search (holding L+H); if even zero chroma is out of range (lightness beyond
 * 0..1), clips the sRGB values instead.
 */
export function clampToSrgb(space: SpaceId, ch: number[]): number[] {
  if (channelsInGamut(space, ch)) return ch.slice();
  const prevHue = hueOf(space, ch);
  const srgb = channelsToSrgb(space, ch);
  const [okL = 0, okC = 0, okH = 0] = srgbToChannels("oklch", srgb, prevHue);

  // If chroma 0 is still out of gamut, lightness itself is out of range → clip.
  if (!srgbInGamut(channelsToSrgb("oklch", [okL, 0, okH]))) {
    return srgbToChannels(space, clipSrgb(srgb), prevHue);
  }

  let lo = 0;
  let hi = okC;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (srgbInGamut(channelsToSrgb("oklch", [okL, mid, okH]))) lo = mid;
    else hi = mid;
  }
  const mapped = clipSrgb(channelsToSrgb("oklch", [okL, lo, okH]));
  return srgbToChannels(space, mapped, prevHue);
}
