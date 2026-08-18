import type {
  CSSProperties,
  HTMLAttributes,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { forwardRef, memo, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AnnotationsLayer,
  type AnnotationX,
  anchorRectFromPoint,
  ChartChrome,
  type ChartScaffoldingProps,
  type ChartSelectionProps,
  FullscreenToggle,
  formatNumber,
  formatTickValue,
  getTextMeasurer,
  type LabelBox,
  maxLabelWidth,
  resolveTickFont,
  SelectionPopover,
  scaffoldStyles,
  snapEdges,
  snapFraction,
  Tooltip,
  thinLabels,
  useChartScaffold,
  useChartSelection,
  useMeasuredPlot,
} from "../../lib/chart";
import { contourLevels, marchingSquares } from "../../lib/chart/contours";
import type { Domain, GridData } from "../../lib/chart3d/types";
import { cx } from "../../lib/cx";
import styles from "./Heatmap.module.css";

export interface HeatmapDatum {
  x: number;
  y: number;
  z: number;
}

export interface HeatmapProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    ChartScaffoldingProps,
    ChartSelectionProps<HeatmapDatum> {
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
  /** Plot height. Default `calc(var(--sf-unit) * 14)`. */
  height?: number | string;
  /** Fires on every value-axis zoom/pan (`zoomable`); `null` = full range. The
   *  grid's x/y are categorical, so `zoomable` windows the vertical (y) axis —
   *  a sub-range of rows. */
  onValueDomainChange?: (domain: [number, number] | null) => void;
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

/** Smallest adjacent spacing along a grid axis — the precision tick labels
 *  must resolve (cell centers are raw data values, not nice-step ticks). */
function minStep(values: number[]): number {
  let step = Number.POSITIVE_INFINITY;
  for (let k = 1; k < values.length; k++) {
    const d = Math.abs((values[k] ?? 0) - (values[k - 1] ?? 0));
    if (d > 0 && d < step) step = d;
  }
  return Number.isFinite(step) ? step : 1;
}

interface CellRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Column / data-row indices — the React key and the fill lookup. */
  i: number;
  j: number;
}

interface CellTick {
  key: string;
  label: string;
  /** Axis fraction: x → from the left edge, y → from the top edge. */
  position: number;
}

/** Collision box height for a y tick: one --sf-font-size-sm text line. */
const TICK_LINE_PX = 16;

// The grid layers are memo components (not useMemo'd element arrays) so a
// hover re-render bails out at a single fiber instead of re-reconciling the
// full keyed array — on a dense grid that's 10k+ elements per pointermove.
// Geometry (rects) and color (fills) arrive as separately-memoized props, so
// a resize/zoom re-snap never re-mixes colors and vice versa.
const HeatmapCells = memo(function HeatmapCells({
  rects,
  fills,
  nx,
}: {
  rects: CellRect[];
  fills: string[];
  nx: number;
}) {
  return (
    <>
      {rects.map((c) => (
        <rect
          key={`${c.i}-${c.j}`}
          x={c.x}
          y={c.y}
          width={c.width}
          height={c.height}
          style={{ fill: fills[c.j * nx + c.i] }}
          // Tagged so SelectionPopover can tell a click that moves the pin to
          // a different cell apart from a genuine outside press. Without it,
          // the popover's own outside-press dismiss fires first and the pin
          // flickers closed, then reopens.
          data-chart-mark=""
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

/** Shared by the hover tooltip and the pinned-selection popover, so a
 *  consumer that supplies neither `renderTooltip` nor `renderSelection`
 *  still gets a sensible default in both places. */
function defaultTooltip(datum: HeatmapDatum): ReactNode {
  return (
    <span className={styles.tip}>
      {datum.z}
      <span className={styles.tipMeta}>
        {" "}
        ({datum.x}, {datum.y})
      </span>
    </span>
  );
}

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
    // Heatmap axes are always drawn today, so its posture defaults to "full"
    // (unlike the "hover" default of the line/bar charts) to keep behaviour.
    scaffolding = "full",
    frame,
    fullscreen,
    controls,
    zoomable,
    zoomOutLimit,
    annotations,
    onAnnotationsChange,
    onValueDomainChange,
    renderTooltip,
    selectable = false,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
    renderSelection,
    className,
    style,
    ...rest
  },
  ref,
) {
  const { ref: plotAreaRef, plotRef, size: plotSize } = useMeasuredPlot<HTMLDivElement>();
  const [hover, setHover] = useState<{
    datum: HeatmapDatum;
    rect: DOMRect;
    i: number;
    row: number;
  } | null>(null);
  // Cells render inline in this component's own render (no separate memoized
  // mark layer, unlike Scatterplot's point layer), so the live `selection`
  // can be closed over directly below. No selectionRef indirection needed.
  const { selection, setSelection } = useChartSelection<HeatmapDatum>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });
  const measure = getTextMeasurer(resolveTickFont(plotRef.current));

  const nx = data.x.length;
  const ny = data.y.length;
  const [lo, hi] = colorScale ?? [
    "color-mix(in srgb, var(--sf-color-primary) 12%, var(--sf-color-bg))",
    "var(--sf-color-primary)",
  ];
  const xDomain = useMemo(() => extent(data.x), [data.x]);
  const yDomain = useMemo(() => extent(data.y), [data.y]);
  const zDom = useMemo(() => zDomain ?? extent(data.z.flat()), [zDomain, data.z]);
  const xStep = useMemo(() => minStep(data.x), [data.x]);
  const yStep = useMemo(() => minStep(data.y), [data.y]);
  // Value → grid-index lookups, so a stored selection (a plain HeatmapDatum,
  // just x/y/z) can be mapped back to the column/row it came from on every
  // render — the same round trip a controlled `selection` prop needs too.
  // First occurrence wins: a heatmap's axis coordinates are expected to be
  // distinct (a grid axis is a set of positions), so this maps a value to a
  // single, deterministic column/row. With duplicate coordinates (degenerate
  // input) the selection maps to the first matching cell.
  const xIndex = useMemo(() => {
    const m = new Map<number, number>();
    data.x.forEach((v, i) => {
      if (!m.has(v)) m.set(v, i);
    });
    return m;
  }, [data.x]);
  const yIndex = useMemo(() => {
    const m = new Map<number, number>();
    data.y.forEach((v, j) => {
      if (!m.has(v)) m.set(v, j);
    });
    return m;
  }, [data.y]);

  // Shared scaffolding: fullscreen, annotation editing, and value-axis (y) zoom.
  // The grid is categorical in both directions, so `zoomable` windows the
  // vertical value axis — a sub-range of rows (issue #35).
  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    controls,
    zoomable,
    annotations,
    onAnnotationsChange,
    value: {
      extent: yDomain,
      onDomainChange: onValueDomainChange,
      minSpan: Math.max((yDomain[1] - yDomain[0]) / 100, Number.EPSILON),
      zoomOutLimit,
      formatValue: formatNumber,
      axis: "y",
    },
  });
  const viewYDomain = zoomable ? scaffold.viewport.domain : yDomain;
  // The zoomed value window expressed as a drawn-row window (grid units,
  // top-down): drawn row r spans r..r+1 with r = 0 the top row. Screen-y grows
  // downward while the value grows upward, so the window's top is the high value.
  const ySpanFull = yDomain[1] - yDomain[0] || 1;
  const fracLo = (viewYDomain[0] - yDomain[0]) / ySpanFull;
  const fracHi = (viewYDomain[1] - yDomain[0]) / ySpanFull;
  const rowWinTop = ny * (1 - fracHi);
  const rowWinSpan = Math.max(ny * (fracHi - fracLo), Number.EPSILON);

  // Data→px for annotations (x over the full x domain, y over the zoomed value
  // domain); the inverses feed the annotation editor.
  const xToPx = (x: AnnotationX) =>
    xDomain[1] === xDomain[0]
      ? 0
      : ((Number(x) - xDomain[0]) / (xDomain[1] - xDomain[0])) * plotSize.width;
  const yToPx = (y: number) => {
    const [y0, y1] = viewYDomain;
    return y1 === y0 ? 0 : (1 - (y - y0) / (y1 - y0)) * plotSize.height;
  };
  scaffold.invertRef.current = {
    xFromPx: (px) =>
      xDomain[0] + (plotSize.width > 0 ? px / plotSize.width : 0) * (xDomain[1] - xDomain[0]),
    yFromPx: (px) => {
      const [y0, y1] = viewYDomain;
      return y1 - (plotSize.height > 0 ? px / plotSize.height : 0) * (y1 - y0);
    },
  };

  // Cell colors, keyed on data/zDomain only — a resize or row zoom never
  // re-mixes 10k color strings. Indexed `[j * nx + i]` (data row j).
  const cellFills = useMemo(() => {
    const out: string[] = [];
    const span = zDom[1] - zDom[0] || 1;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const t = ((data.z[j]?.[i] ?? 0) - zDom[0]) / span;
        const pct = Math.round(Math.max(0, Math.min(1, t)) * 100);
        out.push(`color-mix(in srgb, ${hi} ${pct}%, ${lo})`);
      }
    }
    return out;
  }, [data.z, nx, ny, zDom, lo, hi]);

  // Pixel-space cell geometry, keyed on plot size + the zoomed row window
  // (deliberately separate from the color memo). Each edge rounds
  // independently, so adjacent cells share the same integer edge — no seams
  // and no double-cover (replaces the stretched grid-unit viewBox and its
  // 1.02-wide anti-seam rects). Row j drawn at r = ny-1-j so larger y is up;
  // only the visible row window ±1 row materializes.
  const cellRects = useMemo(() => {
    if (plotSize.width <= 0 || plotSize.height <= 0) return [];
    const cols: { x: number; width: number }[] = [];
    for (let i = 0; i < nx; i++) {
      const edge = snapEdges((i * plotSize.width) / nx, ((i + 1) * plotSize.width) / nx);
      cols.push({ x: edge.start, width: edge.end - edge.start });
    }
    const rowToPx = (r: number) => ((r - rowWinTop) / rowWinSpan) * plotSize.height;
    const firstRow = Math.max(0, Math.floor(rowWinTop) - 1);
    const lastRow = Math.min(ny - 1, Math.ceil(rowWinTop + rowWinSpan));
    const out: CellRect[] = [];
    for (let r = firstRow; r <= lastRow; r++) {
      const edge = snapEdges(rowToPx(r), rowToPx(r + 1));
      const j = ny - 1 - r;
      for (let i = 0; i < nx; i++) {
        const col = cols[i];
        if (col === undefined) continue;
        out.push({
          x: col.x,
          y: edge.start,
          width: col.width,
          height: edge.end - edge.start,
          i,
          j,
        });
      }
    }
    return out;
  }, [plotSize, rowWinTop, rowWinSpan, nx, ny]);

  // Iso-lines scaled grid→px with the cells' own row-window mapping (y flipped
  // to match their orientation). Data marks — not pixel-snapped.
  const isoLines = useMemo(() => {
    if (contours == null || plotSize.width <= 0 || plotSize.height <= 0) return [];
    const levels = contourLevels(zDom[0], zDom[1], contours);
    const px = (gx: number) => (gx / nx) * plotSize.width;
    const py = (gy: number) => ((ny - 1 - gy - rowWinTop) / rowWinSpan) * plotSize.height;
    return levels.flatMap((lvl) =>
      marchingSquares(data.z, lvl).map((s) => ({
        x1: px(s.x1),
        y1: py(s.y1),
        x2: px(s.x2),
        y2: py(s.y2),
      })),
    );
  }, [contours, data.z, zDom, nx, ny, rowWinTop, rowWinSpan, plotSize]);

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

  // Ticks are per-cell-center candidates thinned by measured collision, so
  // every kept tick points at an actual cell center (the old niceTicks values
  // usually fell between cells). Endpoints always survive; the survivor set
  // biases the greedy layout so a live resize doesn't flicker labels in/out.
  const prevXKeys = useRef<Set<string>>(new Set());
  const xTicks = useMemo(() => {
    if (plotSize.width <= 0) return [];
    const entries: CellTick[] = data.x.map((v, i) => ({
      key: `${i}`,
      label: formatTickValue(v, xStep),
      position: snapFraction((i + 0.5) / nx, plotSize.width),
    }));
    const boxes: LabelBox[] = entries.map((e, i) => ({
      center: e.position * plotSize.width,
      size: measure(e.label),
      priority: i === 0 || i === entries.length - 1 ? 2 : 0,
      key: e.key,
    }));
    const keep = thinLabels(boxes, { previousKeys: prevXKeys.current });
    return entries.filter((_, i) => keep[i]);
  }, [data.x, nx, xStep, plotSize.width, measure]);

  const prevYKeys = useRef<Set<string>>(new Set());
  const yTicks = useMemo(() => {
    if (plotSize.height <= 0) return [];
    const entries: CellTick[] = [];
    for (let r = 0; r < ny; r++) {
      const centerFraction = (r + 0.5 - rowWinTop) / rowWinSpan;
      if (centerFraction < 0 || centerFraction > 1) continue; // outside the zoom window
      const j = ny - 1 - r;
      entries.push({
        key: `${j}`,
        label: formatTickValue(data.y[j] ?? 0, yStep),
        position: snapFraction(centerFraction, plotSize.height),
      });
    }
    const boxes: LabelBox[] = entries.map((e, i) => ({
      center: e.position * plotSize.height,
      size: TICK_LINE_PX,
      priority: i === 0 || i === entries.length - 1 ? 2 : 0,
      key: e.key,
    }));
    const keep = thinLabels(boxes, { previousKeys: prevYKeys.current });
    return entries.filter((_, i) => keep[i]);
  }, [data.y, ny, yStep, plotSize.height, rowWinTop, rowWinSpan]);

  // Survivor bias updates after commit — not inside the memos, which
  // StrictMode double-invokes.
  useLayoutEffect(() => {
    prevXKeys.current = new Set(xTicks.map((t) => t.key));
    prevYKeys.current = new Set(yTicks.map((t) => t.key));
  }, [xTicks, yTicks]);

  // Measured y-axis column: the widest row label sets --sf-axis-label-width
  // (8px-quantized so the resize feedback loop cannot oscillate). Measured
  // over ALL row labels, not just the kept ticks: that makes it computable
  // before the plot's first measure and invariant under row zoom, so the plot
  // cell is sized correctly on the first pass — a late column-width change
  // re-commits the full cell grid (measured: +135ms ready / +26MB on 100×100).
  const yAxisWidth = useMemo(
    () =>
      maxLabelWidth(
        data.y.map((v) => formatTickValue(v, yStep)),
        measure,
      ),
    [data.y, yStep, measure],
  );

  // Hit-test a client-space point to the grid cell under it — the single
  // source of truth both the hover path and the click-to-select path resolve
  // through, so they can never disagree about which cell is under the
  // cursor. Maps through the zoomed row window to the drawn row, then to the
  // data row.
  const resolveCell = (
    clientX: number,
    clientY: number,
  ): { i: number; row: number; j: number; datum: HeatmapDatum } | null => {
    const plotEl = plotRef.current;
    if (!plotEl || plotSize.width <= 0 || plotSize.height <= 0) return null;
    const r = plotEl.getBoundingClientRect();
    // clientLeft/Top step inside the plot cell's 1px frame border.
    const fx = (clientX - r.left - plotEl.clientLeft) / plotSize.width;
    const fy = Math.min(1, Math.max(0, (clientY - r.top - plotEl.clientTop) / plotSize.height));
    const i = Math.min(nx - 1, Math.max(0, Math.floor(fx * nx)));
    const row = Math.min(ny - 1, Math.max(0, Math.floor(rowWinTop + fy * rowWinSpan)));
    const j = ny - 1 - row;
    return { i, row, j, datum: { x: data.x[i] ?? 0, y: data.y[j] ?? 0, z: data.z[j]?.[i] ?? 0 } };
  };

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const plotEl = plotRef.current;
    const hit = resolveCell(e.clientX, e.clientY);
    if (!plotEl || !hit) return;
    setHover((prev) => {
      // Bail per cell: pointermoves inside one cell re-use the same state.
      if (prev && prev.i === hit.i && prev.row === hit.row) return prev;
      const anchorX = ((hit.i + 0.5) / nx) * plotSize.width;
      const anchorY = ((hit.row + 0.5 - rowWinTop) / rowWinSpan) * plotSize.height;
      return {
        i: hit.i,
        row: hit.row,
        datum: hit.datum,
        // The hovered cell's center in plot space is the single anchor source.
        rect: anchorRectFromPoint(plotEl, anchorX, anchorY),
      };
    });
  };

  // Click-to-freeze: re-clicking the pinned cell clears it, any other cell
  // moves the pin. Compared by grid indices, not object identity.
  const onActivate = (e: ReactMouseEvent<SVGSVGElement>) => {
    if (!selectable) return;
    const hit = resolveCell(e.clientX, e.clientY);
    if (!hit) return;
    const curI = selection ? xIndex.get(selection.x) : undefined;
    const curJ = selection ? yIndex.get(selection.y) : undefined;
    const same = curI === hit.i && curJ === hit.j;
    setSelection(same ? null : hit.datum);
  };

  // Grid indices of the pinned selection, re-derived from the stored datum's
  // x/y through the index lookups every render (never a lookup into the
  // currently drawn — and possibly row-windowed — cell list).
  const selectionCell = useMemo(() => {
    if (!selectable || !selection) return null;
    const i = xIndex.get(selection.x);
    const j = yIndex.get(selection.y);
    if (i == null || j == null) return null;
    return { i, row: ny - 1 - j };
  }, [selectable, selection, xIndex, yIndex, ny]);

  // The pinned popover's anchor: the same cx/cy derivation `onMove` uses for
  // the hover rect, just from the selected cell's live indices every render
  // instead of at hover time, so it tracks zoom/pan/resize.
  const selectionPoint = useMemo(() => {
    if (!selectionCell || plotSize.width <= 0 || plotSize.height <= 0) return null;
    return {
      x: ((selectionCell.i + 0.5) / nx) * plotSize.width,
      y: ((selectionCell.row + 0.5 - rowWinTop) / rowWinSpan) * plotSize.height,
    };
  }, [selectionCell, nx, rowWinTop, rowWinSpan, plotSize.width, plotSize.height]);

  // The selected cell's own pixel bounds (the same edge math `cellRects`
  // uses), so the emphasis outline lines up exactly with the drawn cell.
  // There is no per-cell DOM node to tag, so this draws as its own overlay.
  const selectionRect = useMemo(() => {
    if (!selectionCell || plotSize.width <= 0 || plotSize.height <= 0) return null;
    const colEdge = snapEdges(
      (selectionCell.i * plotSize.width) / nx,
      ((selectionCell.i + 1) * plotSize.width) / nx,
    );
    const rowToPx = (r: number) => ((r - rowWinTop) / rowWinSpan) * plotSize.height;
    const rowEdge = snapEdges(rowToPx(selectionCell.row), rowToPx(selectionCell.row + 1));
    return {
      x: colEdge.start,
      y: rowEdge.start,
      width: colEdge.end - colEdge.start,
      height: rowEdge.end - rowEdge.start,
    };
  }, [selectionCell, nx, rowWinTop, rowWinSpan, plotSize.width, plotSize.height]);

  const hasAnnotations = scaffold.editingEnabled || (annotations != null && annotations.length > 0);

  const rootStyle: CSSProperties = {
    ...(yAxisWidth > 0 ? { "--sf-axis-label-width": `${yAxisWidth}px` } : {}),
    ...style,
  };

  return (
    <div
      {...rest}
      ref={ref}
      {...scaffold.rootProps}
      {...scaffold.rootData}
      className={cx(
        styles.root,
        frame && scaffoldStyles.frame,
        scaffold.expanded && scaffoldStyles.expanded,
        className,
      )}
      style={rootStyle}
      data-hovered={hover != null ? "true" : undefined}
    >
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
              key={t.key}
              className={styles.yTick}
              style={{ bottom: `${(1 - t.position) * 100}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
        <div ref={plotAreaRef} className={styles.plotCell}>
          {/* One pixel-space SVG for cells, contours, annotations and the zoom
              marquee (the old separate grid-unit cell SVG is gone). An armed
              editor owns the pointer — matching the old overlay, which
              intercepted cell hover while armed. */}
          {plotSize.width > 0 && plotSize.height > 0 ? (
            // biome-ignore lint/a11y/useKeyWithClickEvents: cells have no per-cell DOM node to focus (issue #35's hit-testing is coordinate math, not a scan of discrete marks) — there is no keyboard-reachable target to pair a key handler with; click-to-select is a pointer-only affordance here, same as the hover it pins.
            <svg
              {...scaffold.editor.surfaceProps}
              className={styles.svg}
              width={plotSize.width}
              height={plotSize.height}
              viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
              role="img"
              aria-label={
                rest["aria-label"] ??
                `Heatmap, ${nx}×${ny} grid, values ${formatNumber(zDom[0])} to ${formatNumber(zDom[1])}`
              }
              onPointerMove={(e) => {
                scaffold.editor.surfaceProps.onPointerMove?.(e);
                if (!scaffold.editingEnabled) onMove(e);
              }}
              onPointerLeave={() => setHover(null)}
              onClick={(e) => {
                if (!scaffold.editingEnabled) onActivate(e);
              }}
            >
              <HeatmapCells rects={cellRects} fills={cellFills} nx={nx} />
              <HeatmapContours lines={isoLines} />
              {selectionRect ? (
                <rect
                  x={selectionRect.x}
                  y={selectionRect.y}
                  width={selectionRect.width}
                  height={selectionRect.height}
                  className={styles.selectedCell}
                />
              ) : null}
              {hasAnnotations ? (
                <AnnotationsLayer
                  annotations={
                    scaffold.editingEnabled
                      ? scaffold.editor.displayAnnotations
                      : (annotations ?? [])
                  }
                  xPx={xToPx}
                  yPx={yToPx}
                  width={plotSize.width}
                  height={plotSize.height}
                  formatXDelta={(a, b) => formatNumber(Math.abs(Number(b) - Number(a)))}
                  formatY={formatNumber}
                  editing={scaffold.editor.layerEditing}
                />
              ) : null}
              {scaffold.viewport.marquee
                ? (() => {
                    const [f0, f1] = scaffold.viewport.marquee;
                    const yTop = (1 - Math.max(f0, f1)) * plotSize.height;
                    const yBot = (1 - Math.min(f0, f1)) * plotSize.height;
                    return (
                      <rect
                        x={0}
                        y={yTop}
                        width={plotSize.width}
                        height={yBot - yTop}
                        className={scaffoldStyles.marquee}
                      />
                    );
                  })()
                : null}
            </svg>
          ) : null}
          {valueCells.length > 0 ? <HeatmapValues cells={valueCells} nx={nx} ny={ny} /> : null}

          <ChartChrome
            scaffold={scaffold}
            controls={!!controls}
            xDataToPx={xToPx}
            yDataToPx={yToPx}
          />
        </div>
        <div className={styles.xAxis}>
          {xTicks.map((t) => (
            <span key={t.key} className={styles.xTick} style={{ left: `${t.position * 100}%` }}>
              {t.label}
            </span>
          ))}
        </div>
        {xLabel ? <div className={styles.xLabel}>{xLabel}</div> : null}
      </div>
      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}
      <Tooltip open={hover != null} anchorRect={hover?.rect ?? null}>
        {hover ? (renderTooltip?.(hover.datum) ?? defaultTooltip(hover.datum)) : null}
      </Tooltip>

      {selectable ? (
        <SelectionPopover
          open={selection != null && selectionPoint != null}
          plotEl={plotRef.current}
          x={selectionPoint?.x ?? null}
          y={selectionPoint?.y ?? null}
          onClose={() => setSelection(null)}
        >
          {selection ? (renderSelection ?? renderTooltip ?? defaultTooltip)(selection) : null}
        </SelectionPopover>
      ) : null}
    </div>
  );
});
