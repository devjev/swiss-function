// Parse CSS colour strings into a { space, channels, alpha } record and serialize
// back. Handles hex + the CSS Color 4 functions we edit; anything else falls back
// to the browser (a canvas) resolved into sRGB.

import { channelsToSrgb, convert, hexToSrgb, srgbToHex } from "./convert";
import { srgbInGamut } from "./gamut";
import type { SpaceId } from "./spaces";

export interface ParsedColor {
  space: SpaceId;
  channels: number[];
  alpha: number;
}

const PI = Math.PI;

// Parse one token to a number, interpreting `%` and hue units per `kind`.
function tok(t: string | undefined, kind: string): number {
  if (!t || t === "none") return 0;
  const v = Number.parseFloat(t);
  if (Number.isNaN(v)) return 0;
  const pct = t.includes("%");
  switch (kind) {
    case "rgb":
      return pct ? (v / 100) * 255 : v;
    case "l01":
      return pct ? v / 100 : v;
    case "l100":
      return v; // % and number both mean 0..100
    case "pct":
      return v;
    case "c-ok":
    case "ab-ok":
      return pct ? (v / 100) * 0.4 : v;
    case "c-lch":
      return pct ? (v / 100) * 150 : v;
    case "ab-lab":
      return pct ? (v / 100) * 125 : v;
    case "hue": {
      if (t.endsWith("turn")) return v * 360;
      if (t.endsWith("rad")) return (v * 180) / PI;
      if (t.endsWith("grad")) return v * 0.9;
      return v; // deg or bare number
    }
    default:
      return v;
  }
}

function splitArgs(inner: string): { parts: string[]; alpha: number } {
  const [main, alphaPart] = inner.split("/");
  const parts = (main ?? "")
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  const alpha = alphaPart != null ? tokAlpha(alphaPart.trim()) : 1;
  return { parts, alpha };
}
function tokAlpha(t: string): number {
  const v = Number.parseFloat(t);
  if (Number.isNaN(v)) return 1;
  return t.includes("%") ? v / 100 : v;
}

function domFallback(css: string): ParsedColor | null {
  if (typeof document === "undefined") return null;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return null;
  // Two sentinels: an invalid colour leaves fillStyle at the sentinel, so if the
  // two reads disagree the input didn't take.
  ctx.fillStyle = "#000";
  ctx.fillStyle = css;
  const a = ctx.fillStyle;
  ctx.fillStyle = "#fff";
  ctx.fillStyle = css;
  const b = ctx.fillStyle;
  if (a !== b || typeof a !== "string") return null;
  if (a.startsWith("#")) {
    const hx = hexToSrgb(a);
    return hx
      ? {
          space: "rgb",
          channels: [hx.srgb[0] * 255, hx.srgb[1] * 255, hx.srgb[2] * 255],
          alpha: hx.alpha,
        }
      : null;
  }
  const m = a.match(/[\d.]+/g);
  if (!m || m.length < 3) return null;
  const nums = m.map(Number);
  return {
    space: "rgb",
    channels: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0],
    alpha: nums[3] ?? 1,
  };
}

/** Parse a CSS colour string, or `null` if unrecognised. */
export function parse(css: string): ParsedColor | null {
  const s = css.trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("#")) {
    const hx = hexToSrgb(s);
    return hx
      ? {
          space: "rgb",
          channels: [hx.srgb[0] * 255, hx.srgb[1] * 255, hx.srgb[2] * 255],
          alpha: hx.alpha,
        }
      : domFallback(s);
  }
  const fn = /^([a-z]+)\(([^)]*)\)$/.exec(s);
  if (fn?.[1] != null && fn[2] != null) {
    const name = fn[1];
    const { parts, alpha } = splitArgs(fn[2]);
    const p = (i: number) => parts[i];
    switch (name) {
      case "rgb":
      case "rgba":
        return {
          space: "rgb",
          channels: [tok(p(0), "rgb"), tok(p(1), "rgb"), tok(p(2), "rgb")],
          alpha,
        };
      case "hsl":
      case "hsla":
        return {
          space: "hsl",
          channels: [tok(p(0), "hue"), tok(p(1), "pct"), tok(p(2), "pct")],
          alpha,
        };
      case "oklch":
        return {
          space: "oklch",
          channels: [tok(p(0), "l01"), tok(p(1), "c-ok"), tok(p(2), "hue")],
          alpha,
        };
      case "oklab":
        return {
          space: "oklab",
          channels: [tok(p(0), "l01"), tok(p(1), "ab-ok"), tok(p(2), "ab-ok")],
          alpha,
        };
      case "lch":
        return {
          space: "lch",
          channels: [tok(p(0), "l100"), tok(p(1), "c-lch"), tok(p(2), "hue")],
          alpha,
        };
      case "lab":
        return {
          space: "lab",
          channels: [tok(p(0), "l100"), tok(p(1), "ab-lab"), tok(p(2), "ab-lab")],
          alpha,
        };
    }
  }
  return domFallback(s);
}

/** Spaces that have a CSS Color 4 function (HSV/HWB aside — HSV has none). */
export type CssSpace = "rgb" | "hsl" | "oklch" | "oklab" | "lch" | "lab";
/** Output format for {@link toCss}. `"auto"` = hex in sRGB, else `oklch()`. */
export type ColorFormat = "auto" | CssSpace;

const r = (n: number, d: number): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const alphaSuffix = (a: number): string => (a < 1 ? ` / ${r(a, 3)}` : "");
const clampByte = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

function fmtSpace(space: CssSpace, ch: number[], alpha: number): string {
  const [c0 = 0, c1 = 0, c2 = 0] = ch;
  const a = alphaSuffix(alpha);
  switch (space) {
    case "rgb":
      return `rgb(${clampByte(c0)} ${clampByte(c1)} ${clampByte(c2)}${a})`;
    case "hsl":
      return `hsl(${r(c0, 1)} ${r(c1, 1)}% ${r(c2, 1)}%${a})`;
    case "oklch":
      return `oklch(${r(c0, 4)} ${r(c1, 4)} ${r(c2, 2)}${a})`;
    case "oklab":
      return `oklab(${r(c0, 4)} ${r(c1, 4)} ${r(c2, 4)}${a})`;
    case "lch":
      return `lch(${r(c0, 2)} ${r(c1, 2)} ${r(c2, 2)}${a})`;
    case "lab":
      return `lab(${r(c0, 2)} ${r(c1, 2)} ${r(c2, 2)}${a})`;
  }
}

/**
 * Serialize channels to a CSS string. `"auto"` (default) emits `#rrggbb[aa]` when
 * the colour is inside sRGB, otherwise `oklch(...)`. A specific space emits that
 * space's CSS function (converting first if needed).
 */
export function toCss(
  space: SpaceId,
  channels: number[],
  alpha = 1,
  format: ColorFormat = "auto",
): string {
  if (format === "auto") {
    const srgb = channelsToSrgb(space, channels);
    if (srgbInGamut(srgb)) return srgbToHex(srgb, alpha);
    const okl = space === "oklch" ? channels : convert(space, "oklch", channels);
    return fmtSpace("oklch", okl, alpha);
  }
  const ch = format === space ? channels : convert(space, format, channels);
  return fmtSpace(format, ch, alpha);
}
