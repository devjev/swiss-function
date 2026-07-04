import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "../../lib/chart/Tooltip";
import { drawFrameBack, drawFrameFront } from "../../lib/chart3d/frame";
import { nearestHitOrdered, prepareCanvas } from "../../lib/chart3d/paint";
import { computeFit, normalize, projectInto } from "../../lib/chart3d/projection";
import { resolveRgb } from "../../lib/chart3d/shading";
import type { Domain, Point3, PointSeries } from "../../lib/chart3d/types";
import { useOrbit } from "../../lib/chart3d/useOrbit";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { token } from "../../lib/token";
import { useThemeEpoch } from "../../lib/useThemeEpoch";
import styles from "./PointCloud.module.css";

export type PointCloudDatum = Point3 & { series: string };

export interface PointCloudProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  series: PointSeries[];
  xDomain?: Domain;
  yDomain?: Domain;
  zDomain?: Domain;
  xLabel?: string;
  yLabel?: string;
  /** Dot radius in px. Default `3`. */
  pointRadius?: number;
  /** Plot height. Default `calc(var(--sf-unit) * 16)`. */
  height?: number | string;
  /** Show the series legend (default: when more than one series). */
  showLegend?: boolean;
  renderTooltip?: (datum: PointCloudDatum) => ReactNode;
}

const PADDING = 28;

function extentOf(values: number[]): Domain {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? [min, max] : [0, 1];
}

/** Reusable per-frame screen buffers: the redraw runs once per pointermove
 *  during orbit, so it must not allocate per point (20k fresh objects + a full
 *  object sort per frame were the GC-stall source — issue #23). */
interface ScreenBuffers {
  x: Float32Array;
  y: Float32Array;
  depth: Float32Array;
  /** Painter's order (far → near). Persists across frames so consecutive
   *  orbit frames hand the sort nearly-sorted input. */
  order: Uint32Array;
  count: number;
}

export const PointCloud = forwardRef<HTMLDivElement, PointCloudProps>(function PointCloud(
  {
    series,
    xDomain,
    yDomain,
    zDomain,
    xLabel,
    yLabel,
    pointRadius = 3,
    height = "calc(var(--sf-unit) * 16)",
    showLegend,
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
  const screenRef = useRef<ScreenBuffers>({
    x: new Float32Array(0),
    y: new Float32Array(0),
    depth: new Float32Array(0),
    order: new Uint32Array(0),
    count: 0,
  });
  const [hover, setHover] = useState<{ datum: PointCloudDatum; rect: DOMRect } | null>(null);
  // Canvas bakes its token colors into pixels, so repaint on a live theme switch.
  const themeEpoch = useThemeEpoch(rootRef);

  const xDom = useMemo(
    () => xDomain ?? extentOf(series.flatMap((s) => s.data.map((d) => d.x))),
    [xDomain, series],
  );
  const yDom = useMemo(
    () => yDomain ?? extentOf(series.flatMap((s) => s.data.map((d) => d.y))),
    [yDomain, series],
  );
  const zDom = useMemo(
    () => zDomain ?? extentOf(series.flatMap((s) => s.data.map((d) => d.z))),
    [zDomain, series],
  );

  // Normalized coordinates flattened once per data/domain change; the per-frame
  // orbit path only projects + sorts indices over these.
  const flat = useMemo(() => {
    let count = 0;
    for (const s of series) count += s.data.length;
    const nx = new Float32Array(count);
    const ny = new Float32Array(count);
    const nz = new Float32Array(count);
    const seriesIdx = new Uint32Array(count);
    const datums: Point3[] = new Array(count);
    let i = 0;
    let si = 0;
    for (const s of series) {
      for (const d of s.data) {
        nx[i] = normalize(d.x, xDom);
        ny[i] = normalize(d.y, yDom);
        nz[i] = normalize(d.z, zDom);
        seriesIdx[i] = si;
        datums[i] = d;
        i += 1;
      }
      si += 1;
    }
    return { count, nx, ny, nz, seriesIdx, datums };
  }, [series, xDom, yDom, zDom]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: redraw on every relevant input
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const host = rootRef.current;
    if (!canvas || !host || size.width === 0 || size.height === 0) return;
    const ctx = prepareCanvas(canvas, size.width, size.height);
    if (!ctx) return;
    const fit = computeFit(camera, { width: size.width, height: size.height, padding: PADDING });
    const frame = {
      camera,
      fit,
      xDomain: xDom,
      yDomain: yDom,
      zDomain: zDom,
      xLabel,
      yLabel,
      host,
    };

    drawFrameBack(ctx, frame);

    const bg = token("--sf-color-bg", "#ffffff", host);
    const colors = series.map((s) => {
      const rgb = resolveRgb(s.color ?? "var(--sf-color-primary)", host);
      return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
    });

    const buf = screenRef.current;
    if (buf.order.length !== flat.count) {
      buf.x = new Float32Array(flat.count);
      buf.y = new Float32Array(flat.count);
      buf.depth = new Float32Array(flat.count);
      buf.order = new Uint32Array(flat.count);
      for (let i = 0; i < flat.count; i++) buf.order[i] = i;
    }
    buf.count = flat.count;
    projectInto(flat.nx, flat.ny, flat.nz, flat.count, camera, fit, buf.x, buf.y, buf.depth);
    const { x: sx, y: sy, depth, order } = buf;
    order.sort((a, b) => (depth[a] as number) - (depth[b] as number)); // far → near

    ctx.lineWidth = 0.75;
    ctx.strokeStyle = bg;
    let fillColor = "";
    for (let k = 0; k < flat.count; k++) {
      const i = order[k] as number;
      // Subtle depth cue: nearer dots a touch larger (not perspective — a legibility aid).
      const t = ((depth[i] as number) + 0.87) / 1.74;
      const r = pointRadius * (0.75 + 0.4 * t);
      const color = colors[flat.seriesIdx[i] as number] as string;
      if (color !== fillColor) {
        ctx.fillStyle = color;
        fillColor = color;
      }
      ctx.beginPath();
      ctx.arc(sx[i] as number, sy[i] as number, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    drawFrameFront(ctx, frame);
  }, [series, flat, size, camera, xDom, yDom, zDom, pointRadius, xLabel, yLabel, themeEpoch]);

  const onMove = (e: ReactPointerEvent) => {
    handlers.onPointerMove(e);
    if (dragging) {
      if (hover) setHover(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const buf = screenRef.current;
    const idx = nearestHitOrdered(
      buf.x,
      buf.y,
      buf.order,
      buf.count,
      e.clientX - rect.left,
      e.clientY - rect.top,
      12,
    );
    const d = idx >= 0 ? flat.datums[idx] : undefined;
    const s = d ? series[flat.seriesIdx[idx] as number] : undefined;
    setHover(
      d && s
        ? {
            // Built lazily at hover time — the per-frame redraw must not allocate a datum per point.
            datum: { ...d, series: s.name },
            rect: new DOMRect(
              rect.left + (buf.x[idx] as number),
              rect.top + (buf.y[idx] as number),
              0,
              0,
            ),
          }
        : null,
    );
  };

  const legend = (showLegend ?? series.length > 1) && series.length > 0;

  return (
    <div
      {...rest}
      ref={mergeRefs(rootRef, ref)}
      className={cx(styles.root, className)}
      style={style}
    >
      <div
        className={styles.plot}
        style={{ height } as CSSProperties}
        role="img"
        aria-label={ariaLabel ?? `3D point cloud of ${series.length} series. Drag to rotate.`}
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
      </div>
      {legend ? (
        <div className={styles.legend}>
          {series.map((s) => (
            <span key={s.name} className={styles.legendItem}>
              <span
                className={styles.swatch}
                style={{ backgroundColor: s.color ?? "var(--sf-color-primary)" }}
              />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover
          ? (renderTooltip?.(hover.datum) ?? (
              <span className={styles.tip}>
                {hover.datum.label ? `${hover.datum.label} ` : ""}({hover.datum.x}, {hover.datum.y},{" "}
                {hover.datum.z})
              </span>
            ))
          : null}
      </Tooltip>
    </div>
  );
});
