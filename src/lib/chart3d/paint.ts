/** Canvas2D helpers shared by the 3D charts (DPR sizing + nearest-hit). */

/**
 * Size a canvas to its CSS box at device-pixel resolution and return a context
 * pre-scaled so all drawing can use CSS pixels. Returns null if the box is empty
 * or 2D context is unavailable. Mirrors the DPR sizing in lib/effects/webglFill.
 */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): CanvasRenderingContext2D | null {
  if (cssWidth <= 0 || cssHeight <= 0) return null;
  const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  canvas.width = Math.ceil(cssWidth * dpr);
  canvas.height = Math.ceil(cssHeight * dpr);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  return ctx;
}

/** Index of the screen point nearest to (px, py) within `maxDist` px, or -1. */
export function nearestHit(
  points: ReadonlyArray<{ x: number; y: number }>,
  px: number,
  py: number,
  maxDist: number,
): number {
  let best = -1;
  let bestD2 = maxDist * maxDist;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    const d2 = (p.x - px) ** 2 + (p.y - py) ** 2;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}
