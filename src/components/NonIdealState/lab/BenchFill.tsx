// THROWAWAY benchmark rig (Phase 2/3). Implements the dithered fill under
// several renderers behind one interface so probe-nonideal can compare them
// head-to-head. All renderers animate the ripple at the full rAF rate (no
// throttle) so the harness measures each renderer's true per-frame cost.
// Removed once the winner is chosen (Task 3.3).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { quantize, RAMP, ripple } from "../fields";
import styles from "./BenchFill.module.css";

export type BenchRenderer = "dom" | "canvas-rects" | "canvas-text" | "webgl";

const FONT_PX = 10;
const LINE_PX = 11;

function measureCell(host: HTMLElement): { cellW: number; cellH: number } {
  const probe = document.createElement("span");
  probe.textContent = "█".repeat(40);
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;left:-9999px;font:${FONT_PX}px var(--sf-font-mono);line-height:${LINE_PX}px;`;
  host.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  return { cellW: rect.width / 40 || 6, cellH: rect.height || LINE_PX };
}

interface Dims {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  w: number;
  h: number;
}

export function BenchFill({ renderer }: { renderer: BenchRenderer }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const preRef = useRef<HTMLPreElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dims, setDims] = useState<Dims>({
    cols: 0,
    rows: 0,
    cellW: 6,
    cellH: LINE_PX,
    w: 0,
    h: 0,
  });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const { cellW, cellH } = measureCell(el);
      setDims({
        cols: Math.max(1, Math.ceil(r.width / cellW) + 1),
        rows: Math.max(1, Math.ceil(r.height / cellH) + 1),
        cellW,
        cellH,
        w: r.width,
        h: r.height,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let start = 0;
    const draw = (now: number) => {
      if (!start) start = now;
      const t = (now - start) / 1000;
      // Time the actual draw — at these sizes every renderer hits the 60fps
      // rAF ceiling, so per-frame CPU cost (not fps) is the discriminator.
      const t0 = performance.now();
      if (renderer === "dom") drawDom(preRef.current, dims, t);
      const w = window as unknown as { __nisDraw?: number[] };
      if (!w.__nisDraw) w.__nisDraw = [];
      w.__nisDraw.push(performance.now() - t0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [renderer, dims]);

  return (
    <div ref={rootRef} data-nis-root="" className={styles.root}>
      {renderer === "dom" ? (
        <pre ref={preRef} data-nis-fill="" className={styles.pre} />
      ) : (
        <canvas ref={canvasRef} data-nis-fill="" className={styles.canvas} />
      )}
    </div>
  );
}

function drawDom(pre: HTMLPreElement | null, dims: Dims, t: number) {
  if (!pre) return;
  const { cols, rows } = dims;
  const lines: string[] = [];
  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      line += RAMP[quantize(ripple(x, y, cols, rows, t), x, y)];
    }
    lines.push(line);
  }
  pre.textContent = lines.join("\n");
}
