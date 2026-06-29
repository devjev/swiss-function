import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "../../lib/chart/Tooltip";
import { axisTicks, CUBE_EDGES } from "../../lib/chart3d/cube";
import { nearestHit, prepareCanvas } from "../../lib/chart3d/paint";
import { computeFit, normalize, project } from "../../lib/chart3d/projection";
import { faceLambert, lerpRgb, resolveRgb, shade } from "../../lib/chart3d/shading";
import type { Domain, GridData } from "../../lib/chart3d/types";
import { useOrbit } from "../../lib/chart3d/useOrbit";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { token } from "../../lib/token";
import styles from "./Surface.module.css";

export interface SurfaceDatum {
  x: number;
  y: number;
  z: number;
}

export interface SurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Gridded heights: `z[j][i]` is the value at `x[i]`, `y[j]`. */
  data: GridData;
  /** Height (z) domain; defaults to the data's min/max. */
  zDomain?: Domain;
  xLabel?: string;
  yLabel?: string;
  zLabel?: string;
  /** Plot height. Default `calc(var(--sf-unit) * 16)`. */
  height?: number | string;
  /** Draw the hairline mesh over the shaded surface. Default `true`. */
  wireframe?: boolean;
  /** `[low, high]` colors for the height ramp (any CSS color / token expression). */
  colorScale?: [string, string];
  /** Custom hover tooltip; defaults to the x/y/z values. */
  renderTooltip?: (datum: SurfaceDatum) => ReactNode;
}

const PADDING = 28;

function extent(values: number[]): Domain {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? [min, max] : [0, 1];
}

interface HoverVertex {
  x: number;
  y: number;
  datum: SurfaceDatum;
}

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  {
    data,
    zDomain,
    xLabel,
    yLabel,
    zLabel,
    height = "calc(var(--sf-unit) * 16)",
    wireframe = true,
    colorScale,
    renderTooltip,
    className,
    style,
    "aria-label": ariaLabel,
    ...rest
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { camera, dragging, handlers } = useOrbit();
  const hoverVertsRef = useRef<HoverVertex[]>([]);
  const [hover, setHover] = useState<{ datum: SurfaceDatum; rect: DOMRect } | null>(null);

  const xDomain = useMemo(() => extent(data.x), [data.x]);
  const yDomain = useMemo(() => extent(data.y), [data.y]);
  const zDom = useMemo(() => zDomain ?? extent(data.z.flat()), [zDomain, data.z]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // On-demand paint (no animation loop → reduced-motion is moot).
  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw on every relevant input
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const host = rootRef.current;
    if (!canvas || !host || size.width === 0 || size.height === 0) return;
    const ctx = prepareCanvas(canvas, size.width, size.height);
    if (!ctx) return;

    const fit = computeFit(camera, { width: size.width, height: size.height, padding: PADDING });
    const loRgb = resolveRgb(
      colorScale?.[0] ?? "color-mix(in srgb, var(--sf-color-primary) 16%, var(--sf-color-bg))",
      host,
    );
    const hiRgb = resolveRgb(colorScale?.[1] ?? "var(--sf-color-primary)", host);
    const frameColor = token("--sf-color-border-subtle", "#e5e5e5", host);
    const meshColor = token("--sf-color-border", "#d4d4d4", host);
    const fgColor = token("--sf-color-fg", "#0a0a0a", host);
    const fontSans = token("--sf-font-sans", "system-ui", host);

    const nx = data.x.length;
    const ny = data.y.length;
    const nz = (i: number, j: number) => data.z[j]?.[i] ?? 0;

    // Project every grid vertex once (flat, indexed j*nx+i).
    const sx = new Float64Array(nx * ny);
    const sy = new Float64Array(nx * ny);
    const hoverVerts: HoverVertex[] = [];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const p = project(
          normalize(data.x[i] ?? 0, xDomain),
          normalize(data.y[j] ?? 0, yDomain),
          normalize(nz(i, j), zDom),
          camera,
          fit,
        );
        const k = j * nx + i;
        sx[k] = p.x;
        sy[k] = p.y;
        hoverVerts.push({
          x: p.x,
          y: p.y,
          datum: { x: data.x[i] ?? 0, y: data.y[j] ?? 0, z: nz(i, j) },
        });
      }
    }
    hoverVertsRef.current = hoverVerts;

    // Cube frame, split behind/in-front of center.
    const edges = CUBE_EDGES.map(([a, b]) => {
      const pa = project(a[0], a[1], a[2], camera, fit);
      const pb = project(b[0], b[1], b[2], camera, fit);
      return { ax: pa.x, ay: pa.y, bx: pb.x, by: pb.y, depth: (pa.depth + pb.depth) / 2 };
    });
    const drawEdges = (front: boolean) => {
      ctx.strokeStyle = frameColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const e of edges) {
        if (front ? e.depth >= 0 : e.depth < 0) {
          ctx.moveTo(e.ax, e.ay);
          ctx.lineTo(e.bx, e.by);
        }
      }
      ctx.stroke();
    };
    drawEdges(false);

    // Cells, painter-sorted far→near. `gx`/`gy` read projected vertex coords
    // (typed-array access is `number | undefined` under the strict config).
    const gx = (k: number) => sx[k] ?? 0;
    const gy = (k: number) => sy[k] ?? 0;
    type Poly = [number, number, number, number, number, number, number, number];
    interface Cell {
      poly: Poly;
      color: string;
      depth: number;
    }
    const cells: Cell[] = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const k00 = j * nx + i;
        const k10 = j * nx + i + 1;
        const k11 = (j + 1) * nx + i + 1;
        const k01 = (j + 1) * nx + i;
        const lambert = faceLambert(
          normalize(data.x[i] ?? 0, xDomain),
          normalize(data.y[j] ?? 0, yDomain),
          normalize(nz(i, j), zDom),
          normalize(data.x[i + 1] ?? 0, xDomain),
          normalize(data.y[j] ?? 0, yDomain),
          normalize(nz(i + 1, j), zDom),
          normalize(data.x[i] ?? 0, xDomain),
          normalize(data.y[j + 1] ?? 0, yDomain),
          normalize(nz(i, j + 1), zDom),
        );
        const zMean = (nz(i, j) + nz(i + 1, j) + nz(i + 1, j + 1) + nz(i, j + 1)) / 4;
        // Mean screen-y proxies camera depth well enough for a single-valued
        // surface; lower on screen = nearer.
        cells.push({
          poly: [gx(k00), gy(k00), gx(k10), gy(k10), gx(k11), gy(k11), gx(k01), gy(k01)],
          color: shade(lerpRgb(loRgb, hiRgb, normalize(zMean, zDom) + 0.5), lambert),
          depth: (gy(k00) + gy(k11)) / 2,
        });
      }
    }
    cells.sort((a, b) => a.depth - b.depth);

    for (const cell of cells) {
      const p = cell.poly;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[2], p[3]);
      ctx.lineTo(p[4], p[5]);
      ctx.lineTo(p[6], p[7]);
      ctx.closePath();
      ctx.fillStyle = cell.color;
      ctx.fill();
      if (wireframe) {
        ctx.strokeStyle = meshColor;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    drawEdges(true);

    // Axis ticks + labels on the lower-front cube edges.
    ctx.fillStyle = fgColor;
    ctx.font = `11px ${fontSans}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const text = (t: string, p: { x: number; y: number }, dx: number, dy: number) =>
      ctx.fillText(t, p.x + dx, p.y + dy);
    for (const t of axisTicks(xDomain)) text(t.label, project(t.n, 0.5, -0.5, camera, fit), 0, 12);
    for (const t of axisTicks(yDomain)) text(t.label, project(0.5, t.n, -0.5, camera, fit), 14, 0);
    for (const t of axisTicks(zDom)) text(t.label, project(-0.5, 0.5, t.n, camera, fit), -14, 0);
    if (xLabel) text(xLabel, project(0, 0.5, -0.5, camera, fit), 0, 26);
    if (yLabel) text(yLabel, project(0.5, 0, -0.5, camera, fit), 30, 0);
  }, [data, size, camera, zDom, xDomain, yDomain, wireframe, colorScale, xLabel, yLabel]);

  const onMove = (e: ReactPointerEvent) => {
    handlers.onPointerMove(e);
    if (dragging) {
      if (hover) setHover(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const verts = hoverVertsRef.current;
    const idx = nearestHit(verts, e.clientX - rect.left, e.clientY - rect.top, 14);
    const v = idx >= 0 ? verts[idx] : undefined;
    setHover(
      v ? { datum: v.datum, rect: new DOMRect(rect.left + v.x, rect.top + v.y, 0, 0) } : null,
    );
  };

  return (
    <div
      {...rest}
      ref={mergeRefs(rootRef, ref)}
      className={cx(styles.root, className)}
      style={{ height, ...style } as CSSProperties}
      role="img"
      aria-label={
        ariaLabel ??
        `3D surface — x ${fmt(xDomain)}, y ${fmt(yDomain)}, height ${fmt(zDom)}. Drag to rotate.`
      }
    >
      <canvas
        ref={canvasRef}
        className={cx(styles.canvas, dragging && styles.dragging)}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={onMove}
        onPointerUp={handlers.onPointerUp}
        onPointerCancel={handlers.onPointerCancel}
        onPointerLeave={() => setHover(null)}
      />
      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover
          ? (renderTooltip?.(hover.datum) ?? (
              <span className={styles.tip}>
                {zLabel ? `${zLabel}: ` : ""}
                {hover.datum.z}
                <span className={styles.tipMeta}>
                  {" "}
                  ({hover.datum.x}, {hover.datum.y})
                </span>
              </span>
            ))
          : null}
      </Tooltip>
    </div>
  );
});

function fmt([a, b]: Domain): string {
  return `${a} to ${b}`;
}
