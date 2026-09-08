import type { RefObject } from "react";
import { useLayoutEffect } from "react";

/** Optical centring for a round key's label.
 *
 *  A text box is the advance width by the line box, and a glyph rarely sits in
 *  the middle of it: a capital rides high above the descender space, a symbol
 *  or a fallback glyph carries uneven side bearings, a play triangle has its
 *  mass left of its bounding box. So the label is measured as rendered ink:
 *  text is drawn to a canvas in the element's own font (the same font fallback
 *  the page uses), an SVG icon is rasterised from its markup, and the pixels are
 *  scanned. The anchor is the midpoint of the ink's bounding-box centre and its
 *  centre of mass, the usual optical centre, and the label is shifted so that
 *  anchor lands on the centre of its box. */

type Offset = [number, number];
type Done = (offset: Offset | null) => void;

/** Oversampling of the measuring canvas, for sub-pixel anchors. */
const SCALE = 4;

let canvasSingleton: HTMLCanvasElement | null = null;
function getContext(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  canvasSingleton ??= document.createElement("canvas");
  canvasSingleton.width = Math.max(1, Math.ceil(width));
  canvasSingleton.height = Math.max(1, Math.ceil(height));
  const ctx = canvasSingleton.getContext("2d", { willReadFrequently: true });
  if (ctx) ctx.clearRect(0, 0, canvasSingleton.width, canvasSingleton.height);
  return ctx;
}

/** The optical anchor of the ink on the canvas, in canvas pixels: the midpoint
 *  of the bounding-box centre and the alpha-weighted centre of mass. */
function inkAnchor(ctx: CanvasRenderingContext2D): [number, number] | null {
  const { width, height } = ctx.canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let sumX = 0;
  let sumY = 0;
  let mass = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3] ?? 0;
      if (a < 16) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      sumX += (x + 0.5) * a;
      sumY += (y + 0.5) * a;
      mass += a;
    }
  }
  if (maxX < 0 || mass === 0) return null;
  const boxX = (minX + maxX + 1) / 2;
  const boxY = (minY + maxY + 1) / 2;
  return [(boxX + sumX / mass) / 2, (boxY + sumY / mass) / 2];
}

function measureText(el: HTMLElement, text: string): Offset | null {
  const cs = getComputedStyle(el);
  const fontSize = Number.parseFloat(cs.fontSize);
  if (!(fontSize > 0)) return null;
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const probe = getContext(1, 1);
  if (!probe) return null;
  probe.font = font;
  const m = probe.measureText(text);
  const advance = m.width;
  if (!(advance > 0)) return null;
  const fontAscent = m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || fontSize * 0.8;
  const fontDescent = m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || fontSize * 0.2;
  // Where the baseline sits in the element's line box: the half-leading is
  // split evenly around the font's content area.
  const lineHeight = Number.parseFloat(cs.lineHeight) || fontAscent + fontDescent;
  const baselineY = fontAscent + (lineHeight - (fontAscent + fontDescent)) / 2;
  // Draw the glyph with a margin of one em on every side, then find its ink.
  const pad = fontSize;
  const ctx = getContext((advance + 2 * pad) * SCALE, (fontAscent + fontDescent + 2 * pad) * SCALE);
  if (!ctx) return null;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.font = font;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#000";
  ctx.fillText(text, pad, pad + fontAscent);
  const anchor = inkAnchor(ctx);
  if (!anchor) return null;
  // The anchor relative to the pen origin, then to the element box (whose
  // left edge is the origin and whose baseline is at baselineY).
  const inkX = anchor[0] / SCALE - pad;
  const inkY = baselineY + (anchor[1] / SCALE - (pad + fontAscent));
  return [advance / 2 - inkX, lineHeight / 2 - inkY];
}

function measureSvg(svg: SVGSVGElement, done: Done): void {
  const rect = svg.getBoundingClientRect();
  if (!(rect.width > 0) || !(rect.height > 0)) {
    done(null);
    return;
  }
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(rect.width));
  clone.setAttribute("height", String(rect.height));
  const xml = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, "#000");
  const img = new Image();
  img.onload = () => {
    const ctx = getContext(rect.width * SCALE, rect.height * SCALE);
    if (!ctx) return done(null);
    ctx.drawImage(img, 0, 0, rect.width * SCALE, rect.height * SCALE);
    const anchor = inkAnchor(ctx);
    done(anchor ? [rect.width / 2 - anchor[0] / SCALE, rect.height / 2 - anchor[1] / SCALE] : null);
  };
  img.onerror = () => done(null);
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

/** Measure the shift that puts the label's optical centre on the centre of
 *  its box. Text resolves at once; an SVG icon resolves once its raster has
 *  loaded. `done` receives null when there is nothing to measure. */
export function measureInkOffset(el: HTMLElement, done: Done): void {
  const svg = el.querySelector("svg");
  const text = (el.textContent ?? "").trim();
  if (svg && !text) {
    measureSvg(svg, done);
    return;
  }
  if (!text || el.children.length > 0) {
    done(null);
    return;
  }
  done(measureText(el, text));
}

/** Keeps the element's `translate` at the measured optical offset while
 *  `enabled`, re-measuring when the deps change and once the document's fonts
 *  have loaded (the ink changes with the font). Clears it when disabled. */
export function useOpticalCentre(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: readonly unknown[],
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: the caller's deps say when the glyph changed
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!enabled) {
      el.style.translate = "";
      return;
    }
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      measureInkOffset(el, (offset) => {
        if (cancelled) return;
        el.style.translate = offset
          ? `${(Math.round(offset[0] * 4) / 4).toFixed(2)}px ${(Math.round(offset[1] * 4) / 4).toFixed(2)}px`
          : "";
      });
    };
    apply();
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (fonts && fonts.status !== "loaded") fonts.ready.then(apply);
    return () => {
      cancelled = true;
    };
  }, [enabled, ...deps]);
}
