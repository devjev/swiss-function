import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "../../lib/chart/Tooltip";
import { drawFrameBack, drawFrameFront } from "../../lib/chart3d/frame";
import { nearestHit, prepareCanvas } from "../../lib/chart3d/paint";
import { computeFit, normalize, project } from "../../lib/chart3d/projection";
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

interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
  color: string;
  datum: PointCloudDatum;
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
  const pointsRef = useRef<ScreenPoint[]>([]);
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
    const pts: ScreenPoint[] = [];
    for (const s of series) {
      const rgb = resolveRgb(s.color ?? "var(--sf-color-primary)", host);
      const color = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
      for (const d of s.data) {
        const p = project(
          normalize(d.x, xDom),
          normalize(d.y, yDom),
          normalize(d.z, zDom),
          camera,
          fit,
        );
        pts.push({ x: p.x, y: p.y, depth: p.depth, color, datum: { ...d, series: s.name } });
      }
    }
    pts.sort((a, b) => a.depth - b.depth); // far → near
    pointsRef.current = pts;

    for (const p of pts) {
      // Subtle depth cue: nearer dots a touch larger (not perspective — a legibility aid).
      const t = (p.depth + 0.87) / 1.74;
      const r = pointRadius * (0.75 + 0.4 * t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 0.75;
      ctx.strokeStyle = bg;
      ctx.stroke();
    }

    drawFrameFront(ctx, frame);
  }, [series, size, camera, xDom, yDom, zDom, pointRadius, xLabel, yLabel, themeEpoch]);

  const onMove = (e: ReactPointerEvent) => {
    handlers.onPointerMove(e);
    if (dragging) {
      if (hover) setHover(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const pts = pointsRef.current;
    const idx = nearestHit(pts, e.clientX - rect.left, e.clientY - rect.top, 12);
    const p = idx >= 0 ? pts[idx] : undefined;
    setHover(
      p ? { datum: p.datum, rect: new DOMRect(rect.left + p.x, rect.top + p.y, 0, 0) } : null,
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
