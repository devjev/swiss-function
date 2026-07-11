import { token } from "../token";

const MONO_FAMILY_FALLBACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SANS_FAMILY_FALLBACK = "system-ui, sans-serif";
const DEFAULT_SIZE_PX = 14;
/** Average glyph advance as a fraction of font size for the estimator path. */
const ESTIMATE_ADVANCE = 0.62;
const MAX_ENTRIES_PER_FONT = 4096;

let fontCache = new WeakMap<Element, { mono?: string; sans?: string }>();

/**
 * Resolve the canvas `font` string for chart tick labels from the `--sf-*`
 * tokens, reading computed style from `el`'s subtree so `data-theme` and
 * consumer token overrides are honored. Cached per (element, kind) — token
 * values don't change between renders often enough to justify re-reading
 * computed style on every measure pass.
 */
export function resolveTickFont(el: Element | null, kind: "mono" | "sans" = "mono"): string {
  if (typeof document === "undefined") {
    return kind === "mono"
      ? `400 ${DEFAULT_SIZE_PX}px monospace`
      : `400 ${DEFAULT_SIZE_PX}px sans-serif`;
  }
  const source = el ?? document.documentElement;
  const cached = fontCache.get(source);
  const hit = cached?.[kind];
  if (hit !== undefined) return hit;

  const family =
    kind === "mono"
      ? token("--sf-font-mono", MONO_FAMILY_FALLBACK, source)
      : token("--sf-font-sans", SANS_FAMILY_FALLBACK, source);
  const rawSize = token("--sf-font-size-sm", "0.875rem", source);
  const parsed = Number.parseFloat(rawSize);
  // Tokens are rem-valued canonically, but a consumer override may be px.
  const sizePx = Number.isFinite(parsed)
    ? rawSize.trim().endsWith("px")
      ? parsed
      : parsed * rootFontSizePx()
    : DEFAULT_SIZE_PX;

  const font = `400 ${sizePx}px ${family}`;
  const entry = cached ?? {};
  entry[kind] = font;
  fontCache.set(source, entry);
  return font;
}

function rootFontSizePx(): number {
  const px = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) && px > 0 ? px : 16;
}

export type TextMeasurer = (text: string) => number;

// `undefined` = not yet attempted; `null` = attempted, unavailable (SSR/jsdom).
let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  }
  return measureCtx;
}

const widthCaches = new Map<string, Map<string, number>>();

/**
 * Text-width function for one font string, memoized per (font, text).
 *
 * Caveat either way: canvas cannot reproduce `font-size-adjust` (which
 * `--sf-font-mono-adjust` uses to normalize fallback monospace x-height), so
 * fallback-mono widths can differ from the painted text by a few percent —
 * downstream layout adds gap slack that absorbs it.
 */
export function getTextMeasurer(font: string): TextMeasurer {
  let widths = widthCaches.get(font);
  if (!widths) {
    widths = new Map();
    widthCaches.set(font, widths);
  }
  const cache = widths;
  const ctx = getMeasureContext();
  const canMeasure = ctx !== null && typeof ctx.measureText === "function";
  const estimateSizePx = canMeasure ? 0 : parseFontSizePx(font);

  return (text) => {
    const hit = cache.get(text);
    if (hit !== undefined) return hit;
    let width: number;
    if (canMeasure && ctx) {
      ctx.font = font;
      width = ctx.measureText(text).width;
    } else {
      width = text.length * ESTIMATE_ADVANCE * estimateSizePx;
    }
    // Deterministic overflow policy: drop everything rather than track recency.
    if (cache.size >= MAX_ENTRIES_PER_FONT) cache.clear();
    cache.set(text, width);
    return width;
  };
}

function parseFontSizePx(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  const px = match ? Number.parseFloat(match[1] ?? "") : Number.NaN;
  return Number.isFinite(px) ? px : DEFAULT_SIZE_PX;
}

/** Drop all memoized widths and resolved font strings. */
export function clearTextMeasureCache(): void {
  // Clear inner maps too: live measurer closures hold them by reference.
  for (const cache of widthCaches.values()) cache.clear();
  widthCaches.clear();
  fontCache = new WeakMap();
}

// Widths measured before a webfont finishes loading reflect the fallback
// face; invalidate once the real metrics are available.
try {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    document.fonts.ready.then(clearTextMeasureCache, () => {});
  }
} catch {
  // Font Loading API absent (older engines / non-DOM shims) — nothing to invalidate.
}
