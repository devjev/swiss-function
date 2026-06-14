// Perf-regression rig for the chosen WebGL renderer (Phase 3.3). Drives the
// shared webgl fill at the full rAF rate and records per-frame draw CPU time
// to window.__nisDraw for probe-nonideal. Kept minimal; not shipped.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createWebglFill, type WebglFill } from "../webglFill";
import styles from "./BenchFill.module.css";

interface Dims {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  w: number;
  h: number;
}

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

export function BenchFill() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fillRef = useRef<WebglFill | null>(null);
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
    const canvas = canvasRef.current;
    if (!canvas || dims.w === 0) return;
    if (!fillRef.current) fillRef.current = createWebglFill(canvas);
    const fill = fillRef.current;
    if (!fill) return;
    fill.resize(dims.w, dims.h);
    let raf = 0;
    let start = 0;
    const draw = (now: number) => {
      if (!start) start = now;
      const t = (now - start) / 1000;
      const t0 = performance.now();
      fill.draw({ cols: dims.cols, rows: dims.rows, cellW: dims.cellW, cellH: dims.cellH, t });
      const w = window as unknown as { __nisDraw?: number[] };
      if (!w.__nisDraw) w.__nisDraw = [];
      w.__nisDraw.push(performance.now() - t0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [dims]);

  return (
    <div ref={rootRef} data-nis-root="" className={styles.root}>
      <canvas ref={canvasRef} data-nis-fill="" className={styles.canvas} />
    </div>
  );
}
