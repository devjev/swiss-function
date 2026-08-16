/**
 * Canvas2D painters for `AudioPlayer`. Pure drawing: they take a prepared
 * context (CSS-pixel transform from `prepareCanvas`), data, and resolved
 * colours — no DOM reads, no token lookups. Both speak the library's
 * quantized-block language: discrete 2px rungs on a 1px-gap grid, not smooth
 * envelopes.
 */

import { quantizeSteps } from "./AudioPlayer.math";

/** Waveform column cadence: a 2px column every 3px. */
export const WAVE_COLUMN_PITCH = 3;
export const WAVE_COLUMN_WIDTH = 2;
/** Hard cap on drawn waveform columns. */
export const WAVE_MAX_COLUMNS = 512;

/** Live-bar cadence: a 4px bar every 6px, stacked from 2px blocks every 3px. */
export const BAR_PITCH = 6;
export const BAR_WIDTH = 4;
export const BAR_BLOCK_PITCH = 3;
export const BAR_BLOCK_HEIGHT = 2;
/** Hard cap on drawn live bars. */
export const BAR_MAX = 64;

export interface WaveColors {
  /** Played columns and the playhead. */
  accent: string;
  /** Unplayed columns. */
  rest: string;
  /** The hover hairline. */
  hover: string;
}

/** Columns that fit `width` at the waveform cadence. */
export function waveColumnCount(width: number): number {
  return Math.max(1, Math.min(WAVE_MAX_COLUMNS, Math.floor(width / WAVE_COLUMN_PITCH)));
}

/** Bars that fit `width` at the live-bar cadence. */
export function barCount(width: number): number {
  return Math.max(1, Math.min(BAR_MAX, Math.floor(width / BAR_PITCH)));
}

/**
 * Draw the full-track amplitude profile: columns mirrored about the vertical
 * midline, heights snapped to 2px rungs (min one rung, so silence and the
 * decoding state read as a resting baseline), the played prefix in accent, and
 * an exact 1px playhead. `hoverFraction` adds a 1px hairline.
 */
export function drawWaveform(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  columns: Float32Array,
  playedFraction: number,
  hoverFraction: number | null,
  colors: WaveColors,
): void {
  ctx.clearRect(0, 0, width, height);
  const n = columns.length;
  if (n === 0) return;
  // Rungs are half-column steps: the drawn column is 2 × rung px, mirrored.
  const halfSteps = Math.max(1, Math.floor(height / 4));
  const mid = height / 2;
  for (let i = 0; i < n; i++) {
    const level = quantizeSteps(columns[i] ?? 0, halfSteps);
    const half = Math.round(level * halfSteps) * 2;
    const x = i * WAVE_COLUMN_PITCH;
    ctx.fillStyle = (i + 0.5) / n <= playedFraction ? colors.accent : colors.rest;
    ctx.fillRect(x, mid - half, WAVE_COLUMN_WIDTH, half * 2);
  }
  if (hoverFraction != null) {
    ctx.fillStyle = colors.hover;
    ctx.fillRect(Math.round(hoverFraction * width) - 0.5, 0, 1, height);
  }
  if (playedFraction > 0) {
    ctx.fillStyle = colors.accent;
    ctx.fillRect(Math.min(Math.round(playedFraction * width), width - 1) - 0.5, 0, 1, height);
  }
}

/**
 * Draw live analyser bars: bottom-anchored stacks of 2px blocks (the LED-meter
 * read), levels snapped to whole blocks with a one-block floor so an idle or
 * silent signal is a resting baseline row.
 */
export function drawBars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  levels: Float32Array,
  color: string,
): void {
  ctx.clearRect(0, 0, width, height);
  const steps = Math.max(1, Math.floor(height / BAR_BLOCK_PITCH));
  ctx.fillStyle = color;
  for (let i = 0; i < levels.length; i++) {
    const blocks = Math.round(quantizeSteps(levels[i] ?? 0, steps) * steps);
    const x = i * BAR_PITCH;
    for (let k = 0; k < blocks; k++) {
      ctx.fillRect(x, height - (k + 1) * BAR_BLOCK_PITCH + 1, BAR_WIDTH, BAR_BLOCK_HEIGHT);
    }
  }
}
