import type {
  CSSProperties,
  HTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { forwardRef, memo, useMemo, useState } from "react";
import {
  anchorRectFromPoint,
  type ChartScaffoldingProps,
  type ChartSelectionProps,
  FullscreenToggle,
  getTextMeasurer,
  resolveTickFont,
  SelectionPopover,
  scaffoldStyles,
  Tooltip,
  useChartScaffold,
  useChartSelection,
  useMeasuredPlot,
} from "../../lib/chart";
import { cx } from "../../lib/cx";
import { formatNumber } from "../../lib/format";
import {
  type AggregatedNode,
  aggregate,
  findNode,
  layoutTreemap,
  type TreemapCell,
  type TreemapLayout,
  type TreemapNode,
} from "./Treemap.math";
import styles from "./Treemap.module.css";

/** How cells are coloured: neutral, one single-hue tint per top-level group
 *  (a density ladder, never a rainbow), or a diverging success / danger ramp
 *  from each node's `change`. */
export type TreemapColorBy = "none" | "group" | "change";

/** The datum a cell stands for: what `onPointActivate`, the tooltip and the
 *  selection see. Groups and leaves alike. */
export interface TreemapDatum {
  id: string;
  name: string;
  value: number;
  change?: number;
  /** Depth below the drawn root (1 = the drawn root's children). */
  depth: number;
  /** Names from the data root down to this node. */
  path: string[];
  shareOfParent: number;
  shareOfTotal: number;
  parentName?: string;
  kind: "leaf" | "group";
  /** A leaf that stands for an aggregated subtree (the `depth` cut). */
  aggregated: boolean;
  node: TreemapNode;
}

export interface TreemapProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    Pick<ChartScaffoldingProps, "frame" | "fullscreen" | "scaffolding">,
    ChartSelectionProps<TreemapDatum> {
  /** The hierarchy. A parent without a `value` sums its children. */
  data: TreemapNode;
  /** Id of the node to draw as the root (a subtree), for drill-down. Ids
   *  default to the node's path (`"Portfolio/Tech"`); see `treemapPath` for
   *  the breadcrumb. Unknown ids fall back to the data root. */
  root?: string;
  /** Cell colour. Default `"none"`. */
  colorBy?: TreemapColorBy;
  /** The `change` span the diverging ramp saturates at, `[negative, positive]`.
   *  Default: symmetric about zero at the largest absolute change drawn. */
  changeDomain?: [number, number];
  /** Tiling. Default `"squarify"` (siblings sorted by value; the other layouts
   *  keep the input order). */
  layout?: TreemapLayout;
  /** Hairline gap between siblings, px. Default `1`. */
  padding?: number;
  /** Inset inside a group around its children, px. Default `1`. */
  groupPadding?: number;
  /** Levels to draw; deeper subtrees aggregate into one cell. Default all. */
  depth?: number;
  /** Print each cell's value under its name where it fits. */
  showValues?: boolean;
  /** Format a printed value. Default `formatNumber(v, { maximumFractionDigits: 2 })`. */
  valueFormat?: (value: number, datum: TreemapDatum) => string;
  /** Format a change in the tooltip. Default: a signed number with a `%`. */
  changeFormat?: (change: number, datum: TreemapDatum) => string;
  /** `"auto"` prints names (and values) in cells large enough, ellipsized, never
   *  rotated; `"none"` prints nothing (tooltips still carry the names). */
  labels?: "auto" | "none";
  /** Plot height. Default `calc(var(--sf-unit) * 14)`. */
  height?: number | string;
  /** A click (or Enter / Space) on a cell. Drill-down is the consumer's: set
   *  `root` to the datum's id. */
  onPointActivate?: (datum: TreemapDatum) => void;
  renderTooltip?: (datum: TreemapDatum) => ReactNode;
}

const HEADER_PX = 18;
const MIN_HEADER_WIDTH_PX = 40;
/** A leaf narrower / shorter than this prints no name. */
const MIN_LABEL_WIDTH_PX = 36;
const MIN_LABEL_HEIGHT_PX = 16;
/** A leaf needs two lines for a value under its name. */
const MIN_VALUE_HEIGHT_PX = 34;
const CELL_PAD_X_PX = 4;
/** Group tints: one hue at a ladder of densities, cycling. */
const GROUP_MIX = [10, 22, 34, 46, 58, 70];

function defaultValueFormat(value: number): string {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

function defaultChangeFormat(change: number): string {
  const sign = change > 0 ? "+" : "";
  return `${sign}${formatNumber(change, { maximumFractionDigits: 2 })}%`;
}

function percent(share: number): string {
  return `${formatNumber(share * 100, { maximumFractionDigits: 1 })}%`;
}

function toDatum(cell: TreemapCell): TreemapDatum {
  return {
    id: cell.id,
    name: cell.name,
    value: cell.value,
    change: cell.change,
    depth: cell.depth,
    path: cell.path,
    shareOfParent: cell.shareOfParent,
    shareOfTotal: cell.shareOfTotal,
    parentName: cell.parentName,
    kind: cell.kind === "leaf" ? "leaf" : "group",
    aggregated: cell.aggregated,
    node: cell.node,
  };
}

interface DrawnCell {
  cell: TreemapCell;
  style: CSSProperties;
  tone?: "positive" | "negative";
  dither: boolean;
  name: string | null;
  value: string | null;
}

// The cell layer is a memo component so a hover re-render reconciles this one
// fiber instead of the whole tree; the drawn list only changes with data,
// size or colour options.
const TreemapCells = memo(function TreemapCells({
  cells,
  colorBy,
  hoveredId,
  selectedId,
  interactive,
}: {
  cells: DrawnCell[];
  colorBy: TreemapColorBy;
  hoveredId: string | null;
  selectedId: string | null;
  interactive: boolean;
}) {
  return (
    <>
      {cells.map(({ cell, style, tone, dither, name, value }) => (
        <div
          key={`${cell.kind}:${cell.id}`}
          className={styles.cell}
          style={style}
          data-cell-id={cell.id}
          data-kind={cell.kind}
          data-color={cell.kind === "leaf" ? colorBy : undefined}
          data-tone={tone}
          data-dither={dither ? "" : undefined}
          data-hovered={hoveredId === cell.id ? "" : undefined}
          data-selected={selectedId === cell.id ? "" : undefined}
          data-chart-mark=""
          // Leaves and headers are the buttons of an interactive map; a
          // group's container sits under its children and is reached
          // through its header.
          {...(interactive && cell.kind !== "group"
            ? { role: "button", tabIndex: 0, "aria-label": cell.name }
            : {})}
        >
          {name !== null ? (
            <span className={styles.name} title={cell.name}>
              {name}
            </span>
          ) : null}
          {value !== null ? <span className={styles.value}>{value}</span> : null}
        </div>
      ))}
    </>
  );
});

export const Treemap = forwardRef<HTMLDivElement, TreemapProps>(function Treemap(
  {
    data,
    root: rootId,
    colorBy = "none",
    changeDomain,
    layout = "squarify",
    padding = 1,
    groupPadding = 1,
    depth,
    showValues = false,
    valueFormat,
    changeFormat,
    labels = "auto",
    height = "calc(var(--sf-unit) * 14)",
    scaffolding = "hover",
    frame,
    fullscreen,
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const { selection, setSelection } = useChartSelection<TreemapDatum>({
    selectable,
    selection: controlledSelection,
    defaultSelection,
    onSelectionChange,
  });

  // Fullscreen and the root data-attributes come from the shared scaffold; a
  // treemap has no continuous axis, so the viewport stays inert.
  const scaffold = useChartScaffold({
    plotRef,
    scaffolding,
    value: { extent: [0, 1], minSpan: 1, formatValue: String },
  });

  const aggregated = useMemo(() => aggregate(data), [data]);
  const drawnRoot = useMemo(
    () => (rootId != null ? (findNode(aggregated, rootId) ?? aggregated) : aggregated),
    [aggregated, rootId],
  );

  // "minimal" is the pure area read: no hairline gaps, no group headers.
  const minimal = scaffolding === "minimal";
  const cells = useMemo(
    () =>
      layoutTreemap(drawnRoot, plotSize.width, plotSize.height, {
        layout,
        padding: minimal ? 0 : padding,
        groupPadding: minimal ? 0 : groupPadding,
        headerHeight: minimal ? 0 : HEADER_PX,
        maxDepth: depth ?? Number.POSITIVE_INFINITY,
        minHeaderWidth: minimal ? Number.POSITIVE_INFINITY : MIN_HEADER_WIDTH_PX,
      }),
    [drawnRoot, plotSize.width, plotSize.height, layout, padding, groupPadding, depth, minimal],
  );

  const cellById = useMemo(() => {
    const m = new Map<string, TreemapCell>();
    // Leaves and groups first; a header shares its group's id and must not win.
    for (const c of cells) if (c.kind !== "header") m.set(c.id, c);
    return m;
  }, [cells]);

  const changeMax = useMemo(() => {
    if (changeDomain) return Math.max(Math.abs(changeDomain[0]), Math.abs(changeDomain[1]));
    let m = 0;
    for (const c of cells)
      if (c.kind === "leaf" && c.change !== undefined) m = Math.max(m, Math.abs(c.change));
    return m;
  }, [cells, changeDomain]);

  const fmtValue = valueFormat ?? defaultValueFormat;
  const fmtChange = changeFormat ?? defaultChangeFormat;
  const measure = getTextMeasurer(resolveTickFont(plotRef.current));

  const drawn = useMemo<DrawnCell[]>(
    () =>
      cells.map((cell) => {
        const style: CSSProperties = {
          left: cell.x,
          top: cell.y,
          width: cell.width,
          height: cell.height,
        };
        let tone: DrawnCell["tone"];
        let dither = false;
        if (cell.kind === "leaf") {
          if (cell.node.color) {
            style.backgroundColor = cell.node.color;
          } else if (colorBy === "group") {
            const mix = GROUP_MIX[cell.groupIndex % GROUP_MIX.length] ?? 10;
            (style as Record<string, unknown>)["--treemap-mix"] = `${mix}%`;
            dither = Math.floor(cell.groupIndex / GROUP_MIX.length) % 2 === 1;
          } else if (colorBy === "change" && cell.change !== undefined && cell.change !== 0) {
            const t = changeMax > 0 ? Math.min(1, Math.abs(cell.change) / changeMax) : 0;
            (style as Record<string, unknown>)["--treemap-change-mix"] =
              `${Math.round(12 + 58 * t)}%`;
            tone = cell.change > 0 ? "positive" : "negative";
          }
        }
        const datum = toDatum(cell);
        const isHeader = cell.kind === "header";
        const showName =
          labels !== "none" &&
          cell.kind !== "group" &&
          cell.width >= MIN_LABEL_WIDTH_PX &&
          cell.height >= MIN_LABEL_HEIGHT_PX;
        let value: string | null = null;
        if (showValues && showName) {
          const text = fmtValue(cell.value, datum);
          const fits = measure(text) <= cell.width - 2 * CELL_PAD_X_PX;
          if (isHeader) {
            // The header prints its value after the name when both fit.
            if (fits && measure(cell.name) + measure(text) + 3 * CELL_PAD_X_PX <= cell.width) {
              value = text;
            }
          } else if (fits && cell.height >= MIN_VALUE_HEIGHT_PX) {
            value = text;
          }
        }
        return { cell, style, tone, dither, name: showName ? cell.name : null, value };
      }),
    [cells, colorBy, changeMax, labels, showValues, fmtValue, measure],
  );

  const resolve = (target: EventTarget | null): TreemapCell | null => {
    const el = target instanceof Element ? target.closest<HTMLElement>("[data-cell-id]") : null;
    const id = el?.dataset.cellId;
    return id != null ? (cellById.get(id) ?? null) : null;
  };

  const activate = (cell: TreemapCell) => {
    const datum = toDatum(cell);
    onPointActivate?.(datum);
    if (selectable) setSelection(selection?.id === cell.id ? null : datum);
  };

  const onPointerOver = (e: ReactPointerEvent<HTMLDivElement>) => {
    const cell = resolve(e.target);
    setHoveredId(cell ? cell.id : null);
  };
  const onClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    const cell = resolve(e.target);
    if (cell) activate(cell);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const cell = resolve(e.target);
    if (!cell) return;
    e.preventDefault();
    activate(cell);
  };

  const hoveredCell = hoveredId != null ? (cellById.get(hoveredId) ?? null) : null;
  const plotEl = plotRef.current;
  const hoverRect =
    hoveredCell && plotEl
      ? anchorRectFromPoint(
          plotEl,
          hoveredCell.x + hoveredCell.width / 2,
          hoveredCell.y + hoveredCell.height / 2,
        )
      : null;

  // The pinned cell is re-derived from the selection's id every render, so the
  // popover tracks the cell through a resize or a re-layout.
  const selectedCell = selectable && selection ? (cellById.get(selection.id) ?? null) : null;

  const defaultTooltip = (datum: TreemapDatum): ReactNode => (
    <span className={styles.tip}>
      <span className={styles.tipName}>{datum.name}</span> {fmtValue(datum.value, datum)}
      <span className={styles.tipMeta}>
        {" "}
        {percent(datum.shareOfParent)}
        {datum.parentName ? ` of ${datum.parentName}` : ""}
        {datum.parentName && datum.depth > 1 ? `, ${percent(datum.shareOfTotal)} of total` : ""}
      </span>
      {datum.change !== undefined ? (
        <span
          className={styles.tipChange}
          data-tone={datum.change > 0 ? "positive" : datum.change < 0 ? "negative" : undefined}
        >
          {" "}
          {fmtChange(datum.change, datum)}
        </span>
      ) : null}
    </span>
  );

  const interactive = !!onPointActivate || selectable;
  const leafCount = cells.reduce((n, c) => (c.kind === "leaf" ? n + 1 : n), 0);
  const rootDatum = toDatum(drawnRootCell(drawnRoot));
  // An interactive map is a group of cell buttons; a static one is one image
  // with a summarizing label.
  const plotA11y = {
    role: interactive ? "group" : "img",
    "aria-label":
      rest["aria-label"] ??
      `Treemap of ${drawnRoot.name}, ${leafCount} cells, total ${fmtValue(drawnRoot.value, rootDatum)}`,
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
      style={style}
      data-hovered={hoveredId != null ? "true" : undefined}
      data-interactive={interactive ? "" : undefined}
    >
      <div
        className={styles.grid}
        style={
          { "--sf-treemap-h": typeof height === "number" ? `${height}px` : height } as CSSProperties
        }
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: the plot delegates for its cells, which are the focusable buttons when the chart is interactive */}
        <div
          ref={plotAreaRef}
          className={styles.plotCell}
          {...plotA11y}
          onPointerOver={onPointerOver}
          onPointerLeave={() => setHoveredId(null)}
          onClick={onClick}
          onKeyDown={onKeyDown}
        >
          {plotSize.width > 0 && plotSize.height > 0 ? (
            <TreemapCells
              cells={drawn}
              colorBy={colorBy}
              hoveredId={hoveredId}
              selectedId={selectedCell?.id ?? null}
              interactive={interactive}
            />
          ) : null}
        </div>
      </div>
      {fullscreen ? (
        <FullscreenToggle expanded={scaffold.expanded} onToggle={scaffold.toggleExpanded} />
      ) : null}
      <Tooltip open={hoveredCell != null} anchorRect={hoverRect}>
        {hoveredCell ? (renderTooltip ?? defaultTooltip)(toDatum(hoveredCell)) : null}
      </Tooltip>
      {selectable ? (
        <SelectionPopover
          open={selectedCell != null}
          plotEl={plotEl}
          x={selectedCell ? selectedCell.x + selectedCell.width / 2 : null}
          y={selectedCell ? selectedCell.y + selectedCell.height / 2 : null}
          onClose={() => setSelection(null)}
        >
          {selectedCell
            ? (renderSelection ?? renderTooltip ?? defaultTooltip)(toDatum(selectedCell))
            : null}
        </SelectionPopover>
      ) : null}
    </div>
  );
});

/** The drawn root as a cell-shaped object, so the aria label's formatter sees
 *  the same datum shape a cell would give it. */
function drawnRootCell(root: AggregatedNode): TreemapCell {
  return {
    kind: "group",
    id: root.id,
    name: root.name,
    value: root.value,
    change: root.change,
    depth: 0,
    path: root.path,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    groupIndex: 0,
    shareOfParent: 1,
    shareOfTotal: 1,
    node: root.node,
    aggregated: false,
  };
}
