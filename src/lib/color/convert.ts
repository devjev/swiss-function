// Colour-space conversions, hand-rolled (no dependency). Everything routes
// through a single hub: gamma-encoded sRGB as three floats, nominally 0..1 but
// allowed to exceed that range so wide-gamut (OKLCH/Lab) colours survive a
// round-trip. Perceptual spaces use published matrices (Ottosson OKLab; CSS
// Color 4 sRGB↔XYZ and Bradford D65↔D50 for CIE Lab/LCH).

import type { SpaceId } from "./spaces";

export type Vec3 = [number, number, number];
/** Gamma-encoded sRGB, nominally 0..1 (may exceed for out-of-gamut colours). */
export type Srgb = Vec3;

const { abs, sign, cbrt, sin, cos, atan2, hypot, min, max, round, PI } = Math;
const RAD = PI / 180;

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

// --- sRGB transfer function (extended / sign-preserving so it holds for values
// outside [0,1], which out-of-gamut perceptual colours produce) ---
function toLinear(c: number): number {
  const a = abs(c);
  return a <= 0.04045 ? c / 12.92 : sign(c) * ((a + 0.055) / 1.055) ** 2.4;
}
function toGamma(c: number): number {
  const a = abs(c);
  return a <= 0.0031308 ? c * 12.92 : sign(c) * (1.055 * a ** (1 / 2.4) - 0.055);
}

type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

function mul(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

// linear sRGB ↔ XYZ (D65) — CSS Color 4.
// Constants at 15 significant figures (within double precision; the trailing
// digits are far below any perceptual colour threshold).
const LRGB_TO_XYZ: Mat3 = [
  0.412390799265959, 0.357584339383878, 0.180480788401834, 0.21263900587151, 0.715168678767756,
  0.0721923153607337, 0.0193308187155918, 0.119194779794626, 0.950532152249661,
];
const XYZ_TO_LRGB: Mat3 = [
  3.24096994190452, -1.53738317757009, -0.498610760293003, -0.96924363628088, 1.87596750150772,
  0.0415550574071756, 0.0556300796969937, -0.203976958888977, 1.05697151424288,
];
// Bradford chromatic adaptation D65 ↔ D50 — CSS Color 4.
const D65_TO_D50: Mat3 = [
  1.04792982084055, 0.0229467933410191, -0.0501922295431356, 0.0296278156881593, 0.990434484573249,
  -0.0170738250293851, -0.00924305815259118, 0.0150551448965779, 0.751874289958001,
];
const D50_TO_D65: Mat3 = [
  0.955473452704218, -0.0230985368742614, 0.0632593086610217, -0.0283697069632081, 1.00999545800582,
  0.021041398966943, 0.0123140016883199, -0.0205076964334779, 1.33036593660808,
];

// --- OKLab (Björn Ottosson) — operates on *linear* sRGB ---
function linToOklab([r, g, b]: Srgb): Vec3 {
  const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function oklabToLin([L, a, b]: Vec3): Srgb {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// --- CIE Lab (D50 white point, as CSS Color 4 uses) ---
const D50: Vec3 = [0.3457 / 0.3585, 1.0, (1.0 - 0.3457 - 0.3585) / 0.3585];
const LAB_EPS = 216 / 24389;
const LAB_KAPPA = 24389 / 27;
function xyzD50ToLab([X, Y, Z]: Vec3): Vec3 {
  const f = (t: number) => (t > LAB_EPS ? cbrt(t) : (LAB_KAPPA * t + 16) / 116);
  const fx = f(X / D50[0]);
  const fy = f(Y / D50[1]);
  const fz = f(Z / D50[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function labToXyzD50([L, a, b]: Vec3): Vec3 {
  const fy = (L + 16) / 116;
  const fx = a / 500 + fy;
  const fz = fy - b / 200;
  const fx3 = fx * fx * fx;
  const fz3 = fz * fz * fz;
  const xr = fx3 > LAB_EPS ? fx3 : (116 * fx - 16) / LAB_KAPPA;
  const yr = L > LAB_KAPPA * LAB_EPS ? ((L + 16) / 116) ** 3 : L / LAB_KAPPA;
  const zr = fz3 > LAB_EPS ? fz3 : (116 * fz - 16) / LAB_KAPPA;
  return [xr * D50[0], yr * D50[1], zr * D50[2]];
}

// polar (a,b) ↔ (chroma, hue°). At (near-)zero chroma the hue is undefined and
// atan2 returns float noise, so canonicalize to `prevHue` (to keep the slider
// stable) or 0.
function toPolar(a: number, b: number, prevHue?: number): [number, number] {
  const c = hypot(a, b);
  if (c < 1e-6) return [c, prevHue ?? 0];
  let h = atan2(b, a) / RAD;
  if (h < 0) h += 360;
  return [c, h];
}
function fromPolar(c: number, h: number): [number, number] {
  return [c * cos(h * RAD), c * sin(h * RAD)];
}

// --- HSL / HSV (defined on gamma sRGB 0..1) ---
function srgbToHsl([r, g, b]: Srgb): Vec3 {
  const mx = max(r, g, b);
  const mn = min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  let h = 0;
  let s = 0;
  if (d > 1e-9) {
    s = d / (1 - abs(2 * l - 1));
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}
function hslToSrgb([h, s, l]: Vec3): Srgb {
  const S = s / 100;
  const L = l / 100;
  const c = (1 - abs(2 * L - 1)) * S;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = L - c / 2;
  return [r + m, g + m, b + m];
}
function srgbToHsv([r, g, b]: Srgb): Vec3 {
  const mx = max(r, g, b);
  const mn = min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 1e-9) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = mx <= 0 ? 0 : d / mx;
  return [h, s * 100, mx * 100];
}
function hsvToSrgb([h, s, v]: Vec3): Srgb {
  const S = s / 100;
  const V = v / 100;
  const c = V * S;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = V - c;
  return [r + m, g + m, b + m];
}

const lin = (s: Srgb): Srgb => [toLinear(s[0]), toLinear(s[1]), toLinear(s[2])];
const gam = (l: Srgb): Srgb => [toGamma(l[0]), toGamma(l[1]), toGamma(l[2])];

/** Convert a space's channel array (in its display units) to hub sRGB. */
export function channelsToSrgb(space: SpaceId, ch: number[]): Srgb {
  const [c0 = 0, c1 = 0, c2 = 0] = ch;
  switch (space) {
    case "rgb":
      return [c0 / 255, c1 / 255, c2 / 255];
    case "hsl":
      return hslToSrgb([c0, c1, c2]);
    case "hsv":
      return hsvToSrgb([c0, c1, c2]);
    case "oklab":
      return gam(oklabToLin([c0, c1, c2]));
    case "oklch": {
      const [a, b] = fromPolar(c1, c2);
      return gam(oklabToLin([c0, a, b]));
    }
    case "lab":
      return gam(mul(XYZ_TO_LRGB, mul(D50_TO_D65, labToXyzD50([c0, c1, c2]))));
    case "lch": {
      const [a, b] = fromPolar(c1, c2);
      return gam(mul(XYZ_TO_LRGB, mul(D50_TO_D65, labToXyzD50([c0, a, b]))));
    }
  }
}

/** Convert hub sRGB to a space's channel array (in its display units). */
export function srgbToChannels(space: SpaceId, srgb: Srgb, prevHue?: number): number[] {
  switch (space) {
    case "rgb":
      return [srgb[0] * 255, srgb[1] * 255, srgb[2] * 255];
    case "hsl": {
      const [h, s, l] = srgbToHsl(srgb);
      return [s < 1e-6 && prevHue != null ? prevHue : h, s, l];
    }
    case "hsv": {
      const [h, s, v] = srgbToHsv(srgb);
      return [s < 1e-6 && prevHue != null ? prevHue : h, s, v];
    }
    case "oklab":
      return linToOklab(lin(srgb));
    case "oklch": {
      const [L, a, b] = linToOklab(lin(srgb));
      const [c, h] = toPolar(a, b, prevHue);
      return [L, c, h];
    }
    case "lab":
      return xyzD50ToLab(mul(D65_TO_D50, mul(LRGB_TO_XYZ, lin(srgb))));
    case "lch": {
      const [L, a, b] = xyzD50ToLab(mul(D65_TO_D50, mul(LRGB_TO_XYZ, lin(srgb))));
      const [c, h] = toPolar(a, b, prevHue);
      return [L, c, h];
    }
  }
}

/** Convert channels between two spaces (via the sRGB hub). */
export function convert(from: SpaceId, to: SpaceId, ch: number[], prevHue?: number): number[] {
  if (from === to) return ch.slice();
  return srgbToChannels(to, channelsToSrgb(from, ch), prevHue);
}

const hex2 = (n: number): string =>
  round(clamp01(n) * 255)
    .toString(16)
    .padStart(2, "0");

/** sRGB (+ alpha 0..1) to `#rrggbb` or `#rrggbbaa` (clamped into gamut). */
export function srgbToHex(srgb: Srgb, alpha = 1): string {
  const base = `#${hex2(srgb[0])}${hex2(srgb[1])}${hex2(srgb[2])}`;
  return alpha >= 1 ? base : base + hex2(alpha);
}

/** Parse `#rgb`/`#rgba`/`#rrggbb`/`#rrggbbaa` to sRGB + alpha, or `null`. */
export function hexToSrgb(hex: string): { srgb: Srgb; alpha: number } | null {
  const m = /^#?([0-9a-f]{3,8})$/i.exec(hex.trim());
  if (!m?.[1]) return null;
  let h = m[1];
  if (h.length === 3 || h.length === 4)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  const alpha = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { srgb: [r, g, b], alpha };
}

/**
 * CIE 1931 xy chromaticity of a (gamma) sRGB colour. The extended transfer holds
 * for out-of-[0,1] channels, so wide-gamut colours plot outside the sRGB
 * triangle. Returns `null` for black (chromaticity is undefined at zero
 * luminance).
 */
export function srgbToXy(srgb: Srgb): [number, number] | null {
  const lin: Vec3 = [toLinear(srgb[0]), toLinear(srgb[1]), toLinear(srgb[2])];
  const [X, Y, Z] = mul(LRGB_TO_XYZ, lin);
  const sum = X + Y + Z;
  if (sum <= 1e-9) return null;
  return [X / sum, Y / sum];
}

/**
 * The brightest displayable (gamma) sRGB colour at a chromaticity xy — for
 * painting a chromaticity diagram. Out-of-gamut chromaticities clamp their
 * negative components (they wash out toward the spectral edges, as in Photoshop),
 * and the result is normalised so its brightest channel is 1.
 */
export function xyToDisplaySrgb(x: number, y: number): Srgb {
  if (y <= 1e-6) return [0, 0, 0];
  const xyz: Vec3 = [x / y, 1, (1 - x - y) / y];
  const lin = mul(XYZ_TO_LRGB, xyz);
  const r = max(0, lin[0]);
  const g = max(0, lin[1]);
  const b = max(0, lin[2]);
  const m = max(r, g, b, 1e-6);
  return [toGamma(r / m), toGamma(g / m), toGamma(b / m)];
}

/** (Gamma) sRGB → CIE XYZ (D65). */
export function srgbToXyz(srgb: Srgb): Vec3 {
  return mul(LRGB_TO_XYZ, [toLinear(srgb[0]), toLinear(srgb[1]), toLinear(srgb[2])]);
}

/** CIE XYZ (D65) → (gamma) sRGB; may fall outside [0,1] for wide-gamut XYZ. */
export function xyzToSrgb(xyz: Vec3): Srgb {
  const lin = mul(XYZ_TO_LRGB, xyz);
  return [toGamma(lin[0]), toGamma(lin[1]), toGamma(lin[2])];
}
