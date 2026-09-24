import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useId, useMemo, useState } from "react";
import {
  anchorRectFromPoint,
  type ChartFormatProps,
  type ChartScaffoldingProps,
  type ChartSelectionProps,
  ditherCells,
  ditherDots,
  ellipsize,
  FullscreenToggle,
  formatShare,
  getTextMeasurer,
  rampStrength,
  resolveChartFormat,
  resolveTickFont,
  SelectionPopover,
  scaffoldStyles,
  Tooltip,
  useChartScaffold,
  useChartSelection,
  useMeasuredPlot,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import {
  arcPath,
  type PieSlice,
  type PreparedSlice,
  pieRadius,
  placeSliceLabels,
  polar,
  preparePie,
  ringTicks,
  sliceAngles,
  sliceCentroid,
} from "./PieChart.math";
import styles from "./PieChart.module.css";

export type { ChartScaffolding } from "../../lib/chart";
export type { PieSlice, PieSort } from "./PieChart.math";

/** How the slices are painted when they carry no colour of their own. */
export type PieFill = "ramp" | "dither";

/** What gets printed beside a slice's name. */
export type PieValues = boolean | "percent" | "value" | "both";

/** A slice, as the chart reports it on hover, activate and selection. */
export interface PieDatum {
  name: string;
  value: number;
  /** Fraction of the total (0..1). */
  share: number;
  /** Position in the drawn order, clockwise from the start angle. */
  index: number;
  /** The slice is the grouped remainder `maxSlices` made. */
  aggregated: boolean;
  /** How many supplied parts it stands for. `1` for an ordinary slice. */
  count: number;
}

export interface PieChartProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    Pick<ChartScaffoldingProps, "frame" | "fullscreen" | "scaffolding">,
    ChartFormatProps,
    ChartSelectionProps<PieDatum> {
  /** The parts of the whole. A part that is not positive is dropped. */
  data: PieSlice[];
  /** Hole size as a fraction of the outer radius: `0` (default) is the pie,
   *  anything positive is the donut. Clamped to `0.9`. */
  innerRadius?: number;
  /** Slice order. `"value"` (default) puts the biggest at the start angle and
   *  steps down, which is the order a pie is read in; `"none"` keeps the
   *  supplied order for data that carries its own. */
  sort?: "value" | "none";
  /** Where the first slice begins, in degrees clockwise from 12 o'clock.
   *  Default `0`. */
  startAngle?: number;
  /** Cap the number of slices: the smallest are grouped into one remainder
   *  slice. The lever against an unreadable twenty-slice pie. */
  maxSlices?: number;
  /** Name of that grouped remainder. Default `"Other"`. */
  otherLabel?: string;
  /** How a slice with no `color` is painted: the neutral ink ramp (default,
   *  biggest slice darkest) or the house halftone. */
  fill?: PieFill;
  /** Names printed outside the ring on each slice's mid-angle, measured,
   *  ellipsized and thinned so two never collide. `"none"` prints nothing
   *  (the tooltip still carries every name). Default `"auto"`. */
  labels?: "auto" | "none";
  /** What is printed after each name. `true` (the default) prints the share,
   *  which is what a pie is read for; `"value"` prints the figure itself and
   *  `"both"` prints `value (share)`. */
  showValues?: PieValues;
  /** A swatch list under the chart. Off by default, since the slices carry
   *  their own names; turn it on with `labels="none"` for the compact read. */
  legend?: boolean;
  /** Content for the hole, ignored when there is none. Given the hovered or
   *  pinned slice (`null` when neither), so the hole can read out what the
   *  pointer is on. */
  center?: ReactNode | ((focused: PieDatum | null) => ReactNode);
  /** Component height. Default `calc(var(--sf-unit) * 14)`. */
  height?: number | string;
  /** Click / Enter on a slice. Drill-down is an event: swap `data` yourself. */
  onPointActivate?: (datum: PieDatum) => void;
  renderTooltip?: (datum: PieDatum) => ReactNode;
}

/** Radial room for the leader hairline and the gap before the text. */
const LEADER_PX = 6;
const LABEL_GAP = 4;
const LINE_HEIGHT = 16;
/** Gap between the arc and the percent ring, and the two tick lengths. */
const RING_GAP = 3;
const RING_TICK = 4;
const RING_TICK_MAJOR = 7;
/** The label column may not eat more than this share of the width per side. */
const LABEL_CAP = 0.3;
const MAX_INNER_RADIUS = 0.9;

function toDatum(s: PreparedSlice): PieDatum {
  return {
    name: s.name,
    value: s.value,
    share: s.share,
    index: s.index,
    aggregated: s.aggregated,
    count: s.count,
  };
}

/**
 * Parts of one whole as slices of a circle (issue #96): a portfolio's asset mix, a
 * budget's split, where a quarter's revenue came from. `innerRadius` turns the
 * pie into a donut, whose hole can carry a readout of the total or of whatever
 * the pointer is on.
 *
 * Read the shape, not the angles: a pie is honest for a few parts of a total
 * the reader already understands as one whole, and the scaffolding is built to
 * keep it honest. Slices are sorted biggest first from 12 o'clock, they carry
 * their share as a printed figure, the tail can be grouped into one named
 * remainder (`maxSlices`), and the posture draws a percent tick ring so a
 * share can be read off the circumference instead of guessed from an angle.
 * There is no 3D, no explode and no rainbow: the default fill is one ink ramp.
 *
 * Past six or seven parts, or for anything with a hierarchy, reach for
 * `Treemap`; for parts across several categories, `Marimekko` or a stacked
 * `BarChart`.
 */
export const PieChart = forwardRef<HTMLDivElement, PieChartProps>(function PieChart(
  {
    data,
    innerRadius = 0,
    sort = "value",
    startAngle = 0,
    maxSlices,
    otherLabel = "Other",
    fill = "ramp",
    labels = "auto",
    showValues = true,
    legend = false,
    center,
    height,
    scaffolding = "hover",
    frame,
    fullscreen,
    valueFormat,
    tickFormat,
    categoryFormat,
    onPointActivate,
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
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const uid = useId();

  const { selection, setSelection } = useChartSelection<PieDatum>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });

  // Fullscreen and the posture attributes come from the shared scaffold. A pie
  // has no continuous axis, so the viewport stays inert.
  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    value: { extent: [0, 1], minSpan: 1, formatValue: String },
  });

  const format = useMemo(
    () => resolveChartFormat({ valueFormat, tickFormat, categoryFormat }),
    [valueFormat, tickFormat, categoryFormat],
  );

  const { slices, total } = useMemo(
    () => preparePie(data, { sort, ...(maxSlices != null ? { maxSlices } : {}), otherLabel }),
    [data, sort, maxSlices, otherLabel],
  );
  const angles = useMemo(() => sliceAngles(slices, startAngle), [slices, startAngle]);

  const measureSans = getTextMeasurer(resolveTickFont(plotRef.current, "sans"));
  const measureMono = getTextMeasurer(resolveTickFont(plotRef.current, "mono"));

  /* --- What each slice prints ------------------------------------------- */

  const valueMode: "none" | "percent" | "value" | "both" =
    showValues === false ? "none" : showValues === true ? "percent" : showValues;

  const printed = useMemo(
    () =>
      slices.map((s) => {
        if (valueMode === "none") return "";
        const pct = formatShare(s.share);
        if (valueMode === "percent") return pct;
        const v = format.value(s.value);
        return valueMode === "value" ? v : `${v} (${pct})`;
      }),
    [slices, valueMode, format],
  );

  // Labels are laid out from the formatted names, so a `categoryFormat` that
  // lengthens a name is measured, ellipsized and thinned like any other.
  const named = useMemo(
    () => slices.map((s, i) => ({ ...s, name: format.category(s.name, i) })),
    [slices, format],
  );

  /* --- Geometry ---------------------------------------------------------- */

  // The label column is measured, then capped so the pie keeps most of the box:
  // a long holding name may not squeeze the data down to a token circle.
  const reserveX = useMemo(() => {
    if (labels === "none" || plotSize.width <= 0) return 0;
    let widest = 0;
    named.forEach((s, i) => {
      const value = printed[i] ?? "";
      const w = measureSans(s.name) + (value ? measureMono(value) + LABEL_GAP : 0);
      if (w > widest) widest = w;
    });
    return Math.min(plotSize.width * LABEL_CAP, widest + LEADER_PX + LABEL_GAP);
  }, [labels, named, printed, plotSize.width, measureSans, measureMono]);

  const reserveY = labels === "none" ? 0 : LINE_HEIGHT / 2 + LEADER_PX + LABEL_GAP;
  const ringRoom = scaffolding === "minimal" ? 0 : RING_GAP + RING_TICK_MAJOR;
  const radius = Math.max(
    0,
    pieRadius(plotSize.width, plotSize.height, reserveX, reserveY) - ringRoom,
  );
  const centerX = plotSize.width / 2;
  const centerY = plotSize.height / 2;
  const hole = Math.max(0, Math.min(innerRadius, MAX_INNER_RADIUS)) * radius;

  const placed = useMemo(() => {
    if (labels === "none") return [];
    return placeSliceLabels(named, angles, {
      cx: centerX,
      cy: centerY,
      radius: radius + ringRoom,
      width: plotSize.width,
      height: plotSize.height,
      leaderPx: LEADER_PX,
      gapPx: LABEL_GAP,
      lineHeight: LINE_HEIGHT,
      measureName: measureSans,
      measureValue: measureMono,
      ellipsize,
      values: printed,
    });
  }, [
    labels,
    named,
    angles,
    centerX,
    centerY,
    radius,
    ringRoom,
    plotSize.width,
    plotSize.height,
    measureSans,
    measureMono,
    printed,
  ]);

  const ring = useMemo(
    () => (scaffolding === "minimal" ? [] : ringTicks(startAngle)),
    [scaffolding, startAngle],
  );

  /* --- Fills -------------------------------------------------------------- */

  const n = Math.max(1, slices.length);
  const swatchOf = (s: PreparedSlice) =>
    s.color ??
    `color-mix(in srgb, var(--sf-color-fg) ${Math.round(
      (fill === "dither" ? ditherDots(s.index, n) / 16 : rampStrength(s.index, n)) * 100,
    )}%, var(--sf-color-bg))`;
  const fillOf = (s: PreparedSlice) =>
    s.color ?? (fill === "dither" ? `url(#${uid}-d${s.index})` : swatchOf(s));

  /* --- Interaction --------------------------------------------------------- */

  const activatable = !!onPointActivate || selectable;
  const activate = (s: PreparedSlice) => {
    const datum = toDatum(s);
    onPointActivate?.(datum);
    if (!selectable) return;
    setSelection(selection?.index === s.index && selection.name === s.name ? null : datum);
  };
  const onMarkKeyDown = (s: PreparedSlice) => (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate(s);
    }
  };

  const hovered = hoveredIndex != null ? (slices[hoveredIndex] ?? null) : null;
  const plotEl = plotRef.current;
  const anchorOf = (s: PreparedSlice) => {
    const a = angles[s.index];
    if (!a) return null;
    return sliceCentroid(centerX, centerY, radius, hole, a.mid);
  };
  const hoverPoint = hovered ? anchorOf(hovered) : null;
  const hoverRect =
    hovered && plotEl && hoverPoint
      ? anchorRectFromPoint(plotEl, hoverPoint.x, hoverPoint.y)
      : null;

  // The pinned slice is re-derived from the selection every render, so the
  // popover tracks its mark through a resize or a change of data.
  const selectedSlice =
    selectable && selection
      ? (slices.find((s) => s.index === selection.index && s.name === selection.name) ?? null)
      : null;
  const selectionPoint = selectedSlice ? anchorOf(selectedSlice) : null;

  const focused = hovered ?? selectedSlice;
  const focusedIndex = focused?.index ?? null;

  /* --- Chrome -------------------------------------------------------------- */

  const defaultTooltip = (d: PieDatum): ReactNode => (
    <>
      <div className={styles.tipName}>{d.name}</div>
      <div className={styles.tipValue}>
        {format.value(d.value)} · {formatShare(d.share)}
      </div>
      {d.aggregated ? <div className={styles.tipMeta}>{d.count} parts</div> : null}
    </>
  );
  const tooltip = renderTooltip ?? defaultTooltip;

  const centerContent =
    hole > 0
      ? typeof center === "function"
        ? center(focused ? toDatum(focused) : null)
        : center
      : null;

  const wrapperStyle: CSSProperties = {
    ...(height != null && !scaffold.expanded
      ? { height: typeof height === "number" ? `${height}px` : height }
      : {}),
    ...style,
  };

  const summary =
    slices.length > 0
      ? `Pie chart of ${slices.length} parts, total ${format.value(total)}`
      : "Pie chart, no data";

  return (
    <div
      {...rest}
      ref={ref}
      {...scaffold.rootData}
      className={cx(
        styles.root,
        frame && scaffoldStyles.frame,
        scaffold.expanded && scaffoldStyles.expanded,
        className,
      )}
      style={wrapperStyle}
      data-hovered={hovered != null ? "true" : undefined}
      data-fill={fill}
    >
      <div ref={plotAreaRef} className={styles.plot}>
        {plotSize.width > 0 && plotSize.height > 0 && radius > 0 ? (
          <svg
            width={plotSize.width}
            height={plotSize.height}
            viewBox={`0 0 ${plotSize.width} ${plotSize.height}`}
            className={styles.svg}
            role="img"
            aria-label={rest["aria-label"] ?? summary}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {fill === "dither" ? (
              <defs>
                {slices.map((s) =>
                  s.color ? null : (
                    <pattern
                      key={`pat-${s.name}-${s.index}`}
                      id={`${uid}-d${s.index}`}
                      patternUnits="userSpaceOnUse"
                      width={4}
                      height={4}
                    >
                      {ditherCells(ditherDots(s.index, n)).map((c) => (
                        <rect
                          key={`${c.x}-${c.y}`}
                          x={c.x}
                          y={c.y}
                          width={1}
                          height={1}
                          className={styles.ditherDot}
                        />
                      ))}
                    </pattern>
                  ),
                )}
              </defs>
            ) : null}

            {/* The pie's axis is its circumference in percent: a hairline tick
                every 5%, longer at the quarters, so a share can be read off
                the ring instead of guessed. CSS fades it in by posture. */}
            {ring.map((t) => {
              const a = polar(centerX, centerY, radius + RING_GAP, t.angle);
              const b = polar(
                centerX,
                centerY,
                radius + RING_GAP + (t.major ? RING_TICK_MAJOR : RING_TICK),
                t.angle,
              );
              return (
                <line
                  key={`ring-${t.angle}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={cx(styles.ringTick, t.major && styles.ringTickMajor)}
                />
              );
            })}

            {slices.map((s) => {
              const a = angles[s.index];
              if (!a) return null;
              const label = `${named[s.index]?.name ?? s.name}: ${format.value(s.value)}, ${formatShare(s.share)}`;
              return (
                // biome-ignore lint/a11y/useSemanticElements: <button> can't be a direct SVG child; role="button" is the correct ARIA fallback
                <path
                  key={`slice-${s.name}-${s.index}`}
                  d={arcPath(centerX, centerY, radius, hole, a.start, a.end)}
                  className={styles.slice}
                  style={{ fill: fillOf(s) }}
                  data-chart-mark=""
                  data-colored={s.color ? "" : undefined}
                  data-faded={focusedIndex != null && focusedIndex !== s.index ? "" : undefined}
                  data-selected={selectedSlice?.index === s.index ? "" : undefined}
                  data-activatable={activatable ? "" : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={label}
                  onPointerEnter={() => setHoveredIndex(s.index)}
                  onPointerLeave={() => setHoveredIndex(null)}
                  onFocus={() => setHoveredIndex(s.index)}
                  onBlur={() => setHoveredIndex(null)}
                  onClick={activatable ? () => activate(s) : undefined}
                  onKeyDown={activatable ? onMarkKeyDown(s) : undefined}
                >
                  <title>{label}</title>
                </path>
              );
            })}

            {placed.map((p) => (
              <g
                key={`label-${p.index}`}
                data-faded={focusedIndex != null && focusedIndex !== p.index ? "" : undefined}
              >
                <line
                  x1={p.leader.x1}
                  y1={p.leader.y1}
                  x2={p.leader.x2}
                  y2={p.leader.y2}
                  className={styles.leader}
                />
                <text
                  x={p.x}
                  y={p.y}
                  textAnchor={p.anchor}
                  dominantBaseline="central"
                  className={styles.label}
                >
                  {p.title ? <title>{p.title}</title> : null}
                  <tspan>{p.name}</tspan>
                  {p.value ? (
                    <tspan className={styles.labelValue} dx={LABEL_GAP}>
                      {p.value}
                    </tspan>
                  ) : null}
                </text>
              </g>
            ))}
          </svg>
        ) : null}

        {centerContent != null && centerContent !== false ? (
          <div
            className={styles.center}
            style={{
              inlineSize: hole * 1.4,
              blockSize: hole * 1.4,
              insetInlineStart: centerX,
              insetBlockStart: centerY,
            }}
          >
            {centerContent}
          </div>
        ) : null}
      </div>

      {legend ? (
        <div className={styles.legend}>
          {slices.map((s, i) => (
            <span key={`leg-${s.name}-${s.index}`} className={styles.legendItem}>
              <span
                className={styles.legendSwatch}
                style={{ backgroundColor: swatchOf(s) }}
                aria-hidden="true"
              />
              {named[i]?.name ?? s.name}
              {printed[i] ? <span className={styles.legendValue}>{printed[i]}</span> : null}
            </span>
          ))}
        </div>
      ) : null}

      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}

      <Tooltip open={hovered != null} anchorRect={hoverRect}>
        {hovered ? tooltip(toDatum(hovered)) : null}
      </Tooltip>

      {selectable ? (
        <SelectionPopover
          open={selectedSlice != null && selectionPoint != null}
          plotEl={plotEl}
          x={selectionPoint?.x ?? null}
          y={selectionPoint?.y ?? null}
          onClose={() => setSelection(null)}
        >
          {selectedSlice ? (renderSelection ?? tooltip)(toDatum(selectedSlice)) : null}
        </SelectionPopover>
      ) : null}
    </div>
  );
});
