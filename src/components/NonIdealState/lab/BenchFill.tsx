// THROWAWAY benchmark rig (Phase 2/3). Implements the dithered fill under
// several renderers behind one interface so probe-nonideal can compare them
// head-to-head. All renderers animate the ripple at the full rAF rate (no
// throttle) so the harness measures each renderer's true per-frame cost.
// Removed once the winner is chosen (Task 3.3).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { MAX_LEVEL, quantize, RAMP, ripple } from "../fields";
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

  // Size the canvas backing store to block × dpr (crisp + exact coverage).
  useLayoutEffect(() => {
    if (renderer === "dom") return;
    const canvas = canvasRef.current;
    if (!canvas || dims.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.ceil(dims.w * dpr);
    canvas.height = Math.ceil(dims.h * dpr);
    if (renderer === "canvas-rects" || renderer === "canvas-text") {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, [renderer, dims]);

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
      else if (renderer === "canvas-rects") drawCanvasRects(canvasRef.current, dims, t);
      else if (renderer === "canvas-text") drawCanvasText(canvasRef.current, dims, t);
      else if (renderer === "webgl") drawWebgl(canvasRef.current, dims, t);
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

// Reused per-cell level buffer (typed array → no per-frame GC, number-typed
// indexing). Grown as the grid grows.
let levelBuf = new Int8Array(0);

function drawCanvasRects(canvas: HTMLCanvasElement | null, dims: Dims, t: number) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  const { cols, rows, cellW, cellH, w, h } = dims;
  ctx.clearRect(0, 0, w, h);
  const n = cols * rows;
  if (levelBuf.length < n) levelBuf = new Int8Array(n);
  for (let y = 0, i = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++, i++) {
      levelBuf[i] = quantize(ripple(x, y, cols, rows, t), x, y);
    }
  }
  // One fillStyle per level (batched), then a fillRect per cell of that level.
  for (let l = 1; l <= MAX_LEVEL; l++) {
    ctx.fillStyle = `rgba(107,114,128,${l / MAX_LEVEL})`;
    for (let y = 0, i = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++, i++) {
        if (levelBuf[i] === l) ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
      }
    }
  }
}

function drawCanvasText(canvas: HTMLCanvasElement | null, dims: Dims, t: number) {
  const ctx = canvas?.getContext("2d");
  if (!ctx) return;
  const { cols, rows, cellW, cellH, w, h } = dims;
  ctx.clearRect(0, 0, w, h);
  ctx.font = `${FONT_PX}px ui-monospace, monospace`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(107,114,128,1)";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lvl = quantize(ripple(x, y, cols, rows, t), x, y);
      if (lvl > 0) ctx.fillText(RAMP[lvl] ?? "", x * cellW, y * cellH);
    }
  }
}

// --- WebGL: the GPU computes ripple + Bayer dither per pixel; the CPU only
// updates a time uniform and issues one draw call. ---
const BAYER16 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

interface GlState {
  gl: WebGLRenderingContext;
  u: Record<string, WebGLUniformLocation | null>;
}
const glMap = new WeakMap<HTMLCanvasElement, GlState | null>();

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";
const FRAG = `precision mediump float;
uniform vec2 u_res;uniform vec2 u_cell;uniform vec2 u_grid;uniform float u_t;uniform float u_bayer[16];
void main(){
  float cx=floor(gl_FragCoord.x/u_cell.x);
  float cy=floor((u_res.y-gl_FragCoord.y)/u_cell.y);
  float ox=(u_grid.x-1.0)*0.5;float oy=(u_grid.y-1.0)*0.5;
  float dx=cx-ox;float dy=(cy-oy)*1.7;
  float dist=sqrt(dx*dx+dy*dy);
  float inten=(0.5+0.5*sin(dist*(6.2831853/11.0)-u_t*3.0))*0.95;
  int idx=int(mod(cy,4.0))*4+int(mod(cx,4.0));
  float th=0.0;
  for(int k=0;k<16;k++){if(k==idx)th=u_bayer[k];}
  float scaled=clamp(inten,0.0,1.0)*4.0;
  float base=floor(scaled);
  float level=min(base+(scaled-base>th?1.0:0.0),4.0);
  gl_FragColor=vec4(0.42,0.447,0.502,level/4.0);
}`;

function initGl(canvas: HTMLCanvasElement): GlState | null {
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL call, not a React hook
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const u = {
    res: gl.getUniformLocation(prog, "u_res"),
    cell: gl.getUniformLocation(prog, "u_cell"),
    grid: gl.getUniformLocation(prog, "u_grid"),
    t: gl.getUniformLocation(prog, "u_t"),
  };
  gl.uniform1fv(gl.getUniformLocation(prog, "u_bayer[0]"), BAYER16);
  return { gl, u };
}

function drawWebgl(canvas: HTMLCanvasElement | null, dims: Dims, t: number) {
  if (!canvas) return;
  let state = glMap.get(canvas);
  if (state === undefined) {
    state = initGl(canvas);
    glMap.set(canvas, state);
  }
  if (!state) return;
  const { gl, u } = state;
  const dpr = window.devicePixelRatio || 1;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(u.res ?? null, canvas.width, canvas.height);
  gl.uniform2f(u.cell ?? null, dims.cellW * dpr, dims.cellH * dpr);
  gl.uniform2f(u.grid ?? null, dims.cols, dims.rows);
  gl.uniform1f(u.t ?? null, t);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
