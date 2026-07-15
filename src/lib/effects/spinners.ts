/** CLI-style animated glyph spinners — a registry of frame sequences plus a hook
 *  that cycles them. The text/loading-indicator counterpart to the WebGL dither
 *  fills in this module. Loading indicators are AESTHETICS' sanctioned exception
 *  to "no looping animation". */

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../prefersReducedMotion";

export type SpinnerVariant =
  | "braille"
  | "line"
  | "blocks"
  | "bars"
  | "grow"
  | "bounce"
  | "arrow"
  | "quadrant"
  | "triangle"
  | "circle"
  | "corners"
  | "pipe"
  | "star"
  | "toggle"
  | "dots"
  | "pulse"
  | "scanner"
  | "arrowDouble"
  | "caret"
  | "trigram"
  | "dqpb"
  | "arc"
  | "clockface"
  | "balloon"
  | "weave"
  | "boxCorners"
  | "quadrantHeavy"
  | "static";

export interface SpinnerSpec {
  /** Glyphs cycled in order; each should be the same display width (monospace). */
  frames: string[];
  /** Milliseconds per frame at speed 1. */
  interval: number;
  /** Representative frame shown under `prefers-reduced-motion` (defaults to `frames[0]`). */
  still?: string;
}

const split = (s: string): string[] => [...s];

/** The 28 spinners. Glyphs are monospace/box-drawing/braille/ASCII (no emoji) so
 *  they stay column-aligned and on-brand. Each variant's frames are all the same
 *  display width, so cycling never shifts surrounding layout. */
export const SPINNERS: Record<SpinnerVariant, SpinnerSpec> = {
  braille: { frames: split("⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"), interval: 80 },
  line: { frames: ["|", "/", "-", "\\"], interval: 100 },
  blocks: { frames: split("░▒▓█▓▒"), interval: 110, still: "▓" },
  bars: { frames: split("▁▂▃▄▅▆▇█▇▆▅▄▃▂"), interval: 70, still: "▅" },
  grow: { frames: [" ", ...split("▏▎▍▌▋▊▉█")], interval: 90, still: "▌" },
  bounce: { frames: split("⠁⠂⠄⡀⢀⠠⠐⠈"), interval: 110 },
  arrow: { frames: split("←↖↑↗→↘↓↙"), interval: 100 },
  quadrant: { frames: split("▖▘▝▗"), interval: 130, still: "▚" },
  triangle: { frames: split("◢◣◤◥"), interval: 130 },
  circle: { frames: split("◐◓◑◒"), interval: 120 },
  corners: { frames: split("◰◳◲◱"), interval: 130 },
  pipe: { frames: split("┤┘┴└├┌┬┐"), interval: 100 },
  star: { frames: split("✶✸✹✺✹✷"), interval: 110 },
  toggle: { frames: ["●", "○"], interval: 380 },

  // --- The second 15 ---
  dots: { frames: split("⣾⣽⣻⢿⡿⣟⣯⣷"), interval: 80, still: "⡿" },
  pulse: { frames: split("○◔◑◕●◕◑◔"), interval: 120, still: "●" },
  scanner: {
    frames: [
      "[●    ]",
      "[ ●   ]",
      "[  ●  ]",
      "[   ● ]",
      "[    ●]",
      "[   ● ]",
      "[  ●  ]",
      "[ ●   ]",
    ],
    interval: 90,
    still: "[  ●  ]",
  },
  arrowDouble: { frames: split("⇐⇖⇑⇗⇒⇘⇓⇙"), interval: 100, still: "⇒" },
  caret: { frames: split("▲▶▼◀"), interval: 120, still: "▶" },
  trigram: { frames: split("☰☱☲☳☴☵☶☷"), interval: 120 },
  dqpb: { frames: ["d", "q", "p", "b"], interval: 120 },
  arc: { frames: split("◜◠◝◞◡◟"), interval: 120, still: "◠" },
  clockface: { frames: split("◴◷◶◵"), interval: 120, still: "◴" },
  balloon: { frames: [" ", ".", "o", "O", "@", "*"], interval: 130, still: "O" },
  weave: { frames: split("⢎⡰⢎⡡⢎⡑⢎⠱⠎⡱⢊⡱⢌⡱"), interval: 80 },
  boxCorners: { frames: split("┌┐┘└"), interval: 130 },
  quadrantHeavy: { frames: split("▙▛▜▟"), interval: 130 },
  // Flickering quadrant "static", like signal noise.
  static: { frames: split("▘▝▖▗▚▞▀▄▌▐"), interval: 70, still: "▚" },
};

/** The static glyph for a variant (reduced-motion fallback / SSR first paint). */
export function spinnerStill(variant: SpinnerVariant): string {
  const spec = SPINNERS[variant];
  return spec.still ?? spec.frames[0] ?? "";
}

/**
 * Return the current spinner glyph for `variant`, advancing on its interval
 * (scaled by `speed`). Under `prefers-reduced-motion` it returns the static
 * frame and never starts a timer. Use this to embed a spinner inline in any
 * component without the `Spinner` wrapper.
 */
export function useSpinnerFrame(variant: SpinnerVariant = "braille", speed = 1): string {
  const spec = SPINNERS[variant];
  const [index, setIndex] = useState(0);
  // Reset to the first frame whenever the variant changes so we never index past
  // a shorter sequence.
  const lastVariant = useRef(variant);
  if (lastVariant.current !== variant) {
    lastVariant.current = variant;
    if (index !== 0) setIndex(0);
  }

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const step = Math.max(16, spec.interval / (speed || 1));
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % spec.frames.length);
    }, step);
    return () => clearInterval(id);
  }, [spec, speed]);

  if (prefersReducedMotion()) return spinnerStill(variant);
  return spec.frames[index % spec.frames.length] ?? spec.frames[0] ?? "";
}
