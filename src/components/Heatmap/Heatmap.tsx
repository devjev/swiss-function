import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { forwardRef, memo, useMemo, useRef, useState } from "react";
import { contourLevels, marchingSquares } from "../../lib/chart/contours";
import { formatNumber, niceTicks } from "../../lib/chart/numericTicks";
import { Tooltip } from "../../lib/chart/Tooltip";
import type { Domain, GridData } from "../../lib/chart3d/types";
import { cx } from "../../lib/cx";
import styles from "./Heatmap.module.css";

export interface HeatmapDatum {
  x: number;
  y: number;
  z: number;
}

export interface HeatmapProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Gridded values: `z[j][i]` at `x[i]`, `y[j]`. */
  data: GridData;
  /** Value (z) domain; defaults to the data's min/max. */
  zDomain?: Domain;
  /** `[low, high]` ramp colors (any CSS color / token). */
  colorScale?: [string, string];
  /** Iso-line overlay: a level count, or explicit levels. */
  contours?: number | number[];
  /** Print each cell's value on top of its colour (for coarse, table-like
   *  matrices — a dense grid is unreadable). A halo keeps it legible on any fill. */
  showValues?: boolean;
  /** Format a cell value when `showValues`. Default: `formatNumber(z)`. */
  valueFormat?: (z: number, datum: HeatmapDatum) => string;
  xLabel?: string;
  yLabel?: string;
  /** Plot height. Default `calc(var(--sf-unit) * 14)`. */
  height?: number | string;
  renderTooltip?: (datum: HeatmapDatum) => ReactNode;
}

function extent(values: number[]): Domain {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? [min, max] : [0, 1];
}

// The grid layers are memo components (not useMemo'd element arrays) so a
// hover re-render bails out at a single fiber instead of re-reconciling the
// full keyed array — on a dense grid that's 10k+ elements per pointermove.
const HeatmapCells = memo(function HeatmapCells({
  cells,
}: {
  cells: { x: number; y: number; fill: string }[];
}) {
  return (
    <>
      {cells.map((c) => (
        <rect
          key={`${c.x}-${c.y}`}
          x={c.x}
          y={c.y}
          width={1.02}
          height={1.02}
          style={{ fill: c.fill }}
        />
      ))}
    </>
  );
});

const HeatmapContours = memo(function HeatmapContours({
  lines,
}: {
  lines: { x1: number; y1: number; x2: number; y2: number }[];
}) {
  return (
    <>
      {lines.map((l, k) => (
        <line
          // biome-ignore lint/suspicious/noArrayIndexKey: positional iso-line segments
          key={k}
          x1={l.x1}
          y1={l.y1}
          x2={l.x2}
          y2={l.y2}
          className={styles.contour}
        />
      ))}
    </>
  );
});

const HeatmapValues = memo(function HeatmapValues({
  cells,
  nx,
  ny,
}: {
  cells: { key: string; text: string }[];
  nx: number;
  ny: number;
}) {
  return (
    <div
      className={styles.values}
      aria-hidden="true"
      style={{
        gridTemplateColumns: `repeat(${nx}, 1fr)`,
        gridTemplateRows: `repeat(${ny}, 1fr)`,
      }}
    >
      {cells.map((c) => (
        <span key={c.key} className={styles.value}>
          {c.text}
        </span>
      ))}
    </div>
  );
});

export const Heatmap = forwardRef<HTMLDivElement, HeatmapProps>(function Heatmap(
  {
    data,
    zDomain,
    colorScale,
    contours,
    showValues,
    valueFormat,
    xLabel,
    yLabel,
    height = "calc(var(--sf-unit) * 14)",
    renderTooltip,
    className,
    style,
    ...rest
  },
  ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ datum: HeatmapDatum; rect: DOMRect } | null>(null);

  const nx = data.x.length;
  const ny = data.y.length;
  const [lo, hi] = colorScale ?? [
    "color-mix(in srgb, var(--sf-color-primary) 12%, var(--sf-color-bg))",
    "var(--sf-color-primary)",
  ];
  const xDomain = useMemo(() => extent(data.x), [data.x]);
  const yDomain = useMemo(() => extent(data.y), [data.y]);
  const zDom = useMemo(() => zDomain ?? extent(data.z.flat()), [zDomain, data.z]);

  // Cells: row j drawn at svg-y (ny-1-j) so larger y is up (chart convention).
  const cells = useMemo(() => {
    const out: { x: number; y: number; fill: string }[] = [];
    const span = zDom[1] - zDom[0] || 1;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const t = ((data.z[j]?.[i] ?? 0) - zDom[0]) / span;
        const pct = Math.round(Math.max(0, Math.min(1, t)) * 100);
        out.push({ x: i, y: ny - 1 - j, fill: `color-mix(in srgb, ${hi} ${pct}%, ${lo})` });
      }
    }
    return out;
  }, [data.z, nx, ny, zDom, lo, hi]);

  const isoLines = useMemo(() => {
    if (contours == null) return [];
    const levels = contourLevels(zDom[0], zDom[1], contours);
    return levels.flatMap((lvl) =>
      // Flip y to match the cell orientation.
      marchingSquares(data.z, lvl).map((s) => ({
        x1: s.x1,
        y1: ny - 1 - s.y1,
        x2: s.x2,
        y2: ny - 1 - s.y2,
      })),
    );
  }, [contours, data.z, zDom, ny]);

  // Cell value labels, emitted top row first (j = ny-1) to match the cells'
  // larger-y-up orientation under CSS grid's left-to-right, top-to-bottom flow.
  const valueCells = useMemo(() => {
    if (!showValues) return [];
    const fmt = valueFormat ?? ((z: number) => formatNumber(z));
    const out: { key: string; text: string }[] = [];
    for (let r = 0; r < ny; r++) {
      const j = ny - 1 - r;
      for (let i = 0; i < nx; i++) {
        const z = data.z[j]?.[i] ?? 0;
        out.push({ key: `${i}-${j}`, text: fmt(z, { x: data.x[i] ?? 0, y: data.y[j] ?? 0, z }) });
      }
    }
    return out;
  }, [showValues, valueFormat, data, nx, ny]);

  const xTicks = useMemo(
    () =>
      niceTicks(xDomain[0], xDomain[1]).filter(
        (t) => t.value >= xDomain[0] && t.value <= xDomain[1],
      ),
    [xDomain],
  );
  const yTicks = useMemo(
    () =>
      niceTicks(yDomain[0], yDomain[1]).filter(
        (t) => t.value >= yDomain[0] && t.value <= yDomain[1],
      ),
    [yDomain],
  );
  const frac = (v: number, [a, b]: Domain) => (b === a ? 0 : (v - a) / (b - a));

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    const fy = (e.clientY - r.top) / r.height;
    const i = Math.min(nx - 1, Math.max(0, Math.floor(fx * nx)));
    const j = Math.min(ny - 1, Math.max(0, Math.floor((1 - fy) * ny)));
    setHover({
      datum: { x: data.x[i] ?? 0, y: data.y[j] ?? 0, z: data.z[j]?.[i] ?? 0 },
      rect: new DOMRect(e.clientX, e.clientY, 0, 0),
    });
  };

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)} style={style}>
      <div
        className={styles.grid}
        style={
          { "--sf-heatmap-h": typeof height === "number" ? `${height}px` : height } as CSSProperties
        }
      >
        {yLabel ? <div className={styles.yLabel}>{yLabel}</div> : null}
        <div className={styles.yAxis}>
          {yTicks.map((t) => (
            <span
              key={t.value}
              className={styles.yTick}
              style={{ bottom: `${frac(t.value, yDomain) * 100}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <svg
          ref={svgRef}
          className={styles.plot}
          viewBox={`0 0 ${nx} ${ny}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={
            rest["aria-label"] ??
            `Heatmap, ${nx}×${ny} grid, values ${formatNumber(zDom[0])} to ${formatNumber(zDom[1])}`
          }
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <HeatmapCells cells={cells} />
          <HeatmapContours lines={isoLines} />
        </svg>
        {valueCells.length > 0 ? <HeatmapValues cells={valueCells} nx={nx} ny={ny} /> : null}
        <div className={styles.xAxis}>
          {xTicks.map((t) => (
            <span
              key={t.value}
              className={styles.xTick}
              style={{ left: `${frac(t.value, xDomain) * 100}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        {xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}
      </div>
      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover
          ? (renderTooltip?.(hover.datum) ?? (
              <span className={styles.tip}>
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
