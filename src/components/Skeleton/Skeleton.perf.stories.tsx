import type { Story } from "@ladle/react";
import type { EffectName } from "./Skeleton";
import { Skeleton } from "./Skeleton";

export default { title: "Perf/Skeleton" };

// 24 concurrent dithered fills — 8 past the browser's ~16-active-WebGL-context
// cap — for the perf probes (scripts/perf/scenarios/skeleton.mjs). The pooled
// engine must create exactly ONE WebGL context (window.__sfGl.created) and
// lose none (window.__sfGl.lost); per-fill contexts blanked the oldest 8.
// Doubles as a manual stress story. Never use Math.random here — the
// effect/size assignment must be reproducible.

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GlCounter {
  created: number;
  lost: number;
}

// Count WebGL context creations/evictions page-wide. Installed at module load,
// before any fill mounts (fills take their contexts in post-mount effects).
// Counting only — rendering behavior is untouched.
if (typeof window !== "undefined") {
  const host = window as unknown as { __sfGl?: GlCounter };
  if (!host.__sfGl) {
    const counter: GlCounter = { created: 0, lost: 0 };
    host.__sfGl = counter;
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function patchedGetContext(
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      const ctx = original.apply(this, args);
      const kind = args[0];
      if (ctx && (kind === "webgl" || kind === "webgl2" || kind === "experimental-webgl")) {
        counter.created++;
        this.addEventListener("webglcontextlost", () => counter.lost++, { once: true });
      }
      return ctx;
    } as typeof original;
  }
}

const EFFECTS: EffectName[] = [
  "noise",
  "ripple",
  "scan",
  "plasma",
  "rain",
  "wave",
  "spiral",
  "radar",
  "fire",
  "bars",
  "metaballs",
  "voronoi",
];

const rand = mulberry32(13);
const ITEMS = Array.from({ length: 24 }, () => ({
  effect: EFFECTS[Math.floor(rand() * EFFECTS.length)] as EffectName,
  height: 3 + Math.floor(rand() * 3),
}));

/** 24 animated dithered Skeletons — the WebGL-context-budget probe target. */
export const PerfFills24: Story = () => (
  <div
    data-perf-ready=""
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 8,
      maxWidth: 960,
    }}
  >
    {ITEMS.map((item, i) => (
      <Skeleton
        // biome-ignore lint/suspicious/noArrayIndexKey: static, order-stable list
        key={i}
        effect={item.effect}
        height={item.height}
      />
    ))}
  </div>
);
