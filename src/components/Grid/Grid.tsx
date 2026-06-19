import { useRender } from "@base-ui/react/use-render";
import type { CSSProperties, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useCallback, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { usePointerDrag } from "../../lib/usePointerDrag";
import styles from "./Grid.module.css";

type SizeUnit = number | string;
type TrackList = SizeUnit | SizeUnit[];

/** Which axes get draggable track gutters. `true` / `"both"` enable both. */
export type GridResizable = boolean | "columns" | "rows" | "both";

function parseResizable(r: GridResizable | undefined): { cols: boolean; rows: boolean } {
  if (!r) return { cols: false, rows: false };
  if (r === true || r === "both") return { cols: true, rows: true };
  return { cols: r === "columns", rows: r === "rows" };
}

/** Smallest a track may be dragged to, in px. Mirrors `--sf-grid-track-min`
 *  (calc(--sf-unit * 2) = 48px) so JS clamping and the CSS affordance agree. */
const TRACK_MIN_PX = 48;

interface AxisMetrics {
  sizes: number[];
  gap: number;
}

/** Read resolved px track sizes + gap for one axis off the live grid. */
function measureAxis(grid: HTMLElement, axis: "col" | "row"): AxisMetrics {
  const cs = getComputedStyle(grid);
  const template = axis === "col" ? cs.gridTemplateColumns : cs.gridTemplateRows;
  const gap = Number.parseFloat(axis === "col" ? cs.columnGap : cs.rowGap) || 0;
  const sizes =
    template && template !== "none"
      ? template.split(" ").map(Number.parseFloat).filter(Number.isFinite)
      : [];
  return { sizes, gap };
}

/** Pixel offset of each interior boundary (centered in its gap). */
function boundaries(sizes: number[], gap: number): number[] {
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < sizes.length - 1; i++) {
    acc += sizes[i] ?? 0;
    out.push(acc + i * gap + gap / 2);
  }
  return out;
}

/** Move the boundary after track `index` by `delta` px: track[index] grows and
 *  track[index+1] shrinks by the same amount (sum preserved), clamped so
 *  neither track drops below `TRACK_MIN_PX`. Pure — unit-tested. */
export function redistribute(
  sizes: number[],
  index: number,
  delta: number,
  min: number = TRACK_MIN_PX,
): number[] {
  const a = sizes[index];
  const b = sizes[index + 1];
  if (a == null || b == null) return sizes;
  const maxGrow = b - min; // grow track[index] until its neighbor hits min
  const maxShrink = a - min; // shrink track[index] until it hits min
  const clamped = Math.max(-maxShrink, Math.min(maxGrow, delta));
  const out = sizes.slice();
  out[index] = a + clamped;
  out[index + 1] = b - clamped;
  return out;
}

/** Split a CSS track template into per-track tokens, respecting parentheses so
 *  `minmax(0, 1fr)` / `repeat(...)` aren't split mid-function. */
export function splitTracks(template: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of template.trim()) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** Per-track tokens for a `columns`/`rows` value, so individual tracks can be
 *  overridden to px while the rest keep their flexible (`fr`/`auto`) sizing. */
export function tokenizeTemplate(value: TrackList): string[] {
  if (typeof value === "number") return Array.from({ length: value }, () => "minmax(0, 1fr)");
  if (typeof value === "string") return splitTracks(value);
  return value.map((v) => (typeof v === "number" ? `${v}fr` : v));
}

/** True when a track token sizes flexibly (grows/shrinks with the container):
 *  `fr`, `auto`, `minmax`, intrinsic keywords, or `%`. Fixed lengths are not.
 *  Used to decide whether a dragged boundary should pin its trailing track or
 *  leave it flexible (and flush to the container edge). */
function isFlexibleToken(token: string): boolean {
  return /fr\b|auto|minmax|fit-content|min-content|max-content|%/.test(token);
}

/** Merge per-track tokens with sparse px overrides into a grid-template string;
 *  `null` entries keep the token (and thus their flexibility). */
function mergeTemplate(tokens: string[], overrides: (number | null)[]): string {
  return tokens.map((tok, i) => (overrides[i] != null ? `${overrides[i]}px` : tok)).join(" ");
}

/** Resolve the rendered grid-template for a resizable axis from its prop value +
 *  px overrides. Returns `null` when there's nothing to override (use the plain
 *  template). Falls back to pinning every track to px for exotic templates whose
 *  token count doesn't line up with the live track count (e.g. `repeat(...)`). */
function axisTemplate(
  value: TrackList | undefined,
  overrides: (number | null)[] | null,
  measuredSizes: number[] | undefined,
): string | null {
  if (value === undefined || !overrides || !overrides.some((v) => v != null)) return null;
  const tokens = tokenizeTemplate(value);
  if (tokens.length === overrides.length) return mergeTemplate(tokens, overrides);
  if (measuredSizes && measuredSizes.length === overrides.length) {
    return overrides.map((o, i) => `${o ?? measuredSizes[i]}px`).join(" ");
  }
  return null;
}

export interface GridProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** `number` → `repeat(N, minmax(0, 1fr))`; `string` → raw value; `array` → joined (numbers become `Nfr`). */
  columns?: TrackList;
  /** Same shape as `columns`. */
  rows?: TrackList;
  /** Each entry is one row of `grid-template-areas`; serialized as quoted lines. */
  areas?: string[];
  /** `number` → multiples of `--sf-unit` (1.5rem); `string` → raw CSS value. */
  gap?: number | string;
  columnGap?: number | string;
  rowGap?: number | string;
  flow?: "row" | "column" | "dense" | "row dense" | "column dense";
  autoColumns?: string;
  autoRows?: string;
  alignItems?: CSSProperties["alignItems"];
  justifyItems?: CSSProperties["justifyItems"];
  alignContent?: CSSProperties["alignContent"];
  justifyContent?: CSSProperties["justifyContent"];
  /** Render as `display: inline-grid` instead of `display: grid`. */
  inline?: boolean;
  /** Make track boundaries draggable. The first drag freezes the axis's
   *  `fr`/`auto` tracks to their resolved px sizes, then a gutter redistributes
   *  the two tracks it sits between. Default `false`. */
  resizable?: GridResizable;
  /** Smallest a track may be dragged to, in px. Default 48 (`--sf-unit * 2`). */
  minTrackSize?: number;
  /** Notified when a resize settles (drag end, key press, or gutter reset). */
  onTrackSizesChange?: (axis: "columns" | "rows", sizes: number[]) => void;
  /** Base UI render prop. Defaults to `<div />`. */
  render?: useRender.RenderProp<HTMLAttributes<HTMLElement>>;
  children?: ReactNode;
}

export interface GridItemProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Named grid-area (e.g. `"header"`) or shorthand (e.g. `"1 / 1 / 3 / 3"`). Wins over `col`/`row`/`colSpan`/`rowSpan`. */
  area?: string;
  /** `number` → that column; `string` → raw `grid-column` (e.g. `"1 / 3"`, `"span 2"`). Wins over `colSpan`. */
  col?: string | number;
  /** `number` → that row; `string` → raw `grid-row`. Wins over `rowSpan`. */
  row?: string | number;
  /** Shortcut for `grid-column: span N`. */
  colSpan?: number;
  /** Shortcut for `grid-row: span N`. */
  rowSpan?: number;
  alignSelf?: CSSProperties["alignSelf"];
  justifySelf?: CSSProperties["justifySelf"];
  /** Base UI render prop. Defaults to `<div />`. */
  render?: useRender.RenderProp<HTMLAttributes<HTMLElement>>;
  children?: ReactNode;
}

function toUnit(value: number | string): string {
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

function buildTrackList(value: TrackList): string {
  if (typeof value === "number") return `repeat(${value}, minmax(0, 1fr))`;
  if (typeof value === "string") return value;
  return value.map((v) => (typeof v === "number" ? `${v}fr` : v)).join(" ");
}

function buildGridStyle(props: GridProps): CSSProperties {
  const style: CSSProperties = {
    display: props.inline ? "inline-grid" : "grid",
  };
  if (props.columns !== undefined) style.gridTemplateColumns = buildTrackList(props.columns);
  if (props.rows !== undefined) style.gridTemplateRows = buildTrackList(props.rows);
  if (props.areas !== undefined) {
    style.gridTemplateAreas = props.areas.map((row) => `"${row}"`).join(" ");
  }
  if (props.gap !== undefined) style.gap = toUnit(props.gap);
  if (props.columnGap !== undefined) style.columnGap = toUnit(props.columnGap);
  if (props.rowGap !== undefined) style.rowGap = toUnit(props.rowGap);
  if (props.flow !== undefined) style.gridAutoFlow = props.flow;
  if (props.autoColumns !== undefined) style.gridAutoColumns = props.autoColumns;
  if (props.autoRows !== undefined) style.gridAutoRows = props.autoRows;
  if (props.alignItems !== undefined) style.alignItems = props.alignItems;
  if (props.justifyItems !== undefined) style.justifyItems = props.justifyItems;
  if (props.alignContent !== undefined) style.alignContent = props.alignContent;
  if (props.justifyContent !== undefined) style.justifyContent = props.justifyContent;
  return style;
}

function buildItemStyle(props: GridItemProps): CSSProperties {
  const style: CSSProperties = {};
  if (props.area !== undefined) {
    style.gridArea = props.area;
  } else {
    if (props.col !== undefined) {
      style.gridColumn = typeof props.col === "number" ? String(props.col) : props.col;
    } else if (props.colSpan !== undefined) {
      style.gridColumn = `span ${props.colSpan}`;
    }
    if (props.row !== undefined) {
      style.gridRow = typeof props.row === "number" ? String(props.row) : props.row;
    } else if (props.rowSpan !== undefined) {
      style.gridRow = `span ${props.rowSpan}`;
    }
  }
  if (props.alignSelf !== undefined) style.alignSelf = props.alignSelf;
  if (props.justifySelf !== undefined) style.justifySelf = props.justifySelf;
  return style;
}

const GridRoot = forwardRef<HTMLElement, GridProps>(function Grid(props, ref) {
  const {
    columns,
    rows,
    areas,
    gap,
    columnGap,
    rowGap,
    flow,
    autoColumns,
    autoRows,
    alignItems,
    justifyItems,
    alignContent,
    justifyContent,
    inline,
    resizable,
    minTrackSize,
    onTrackSizesChange,
    render,
    className,
    style,
    children,
    ...rest
  } = props;

  const { cols: resizeCols, rows: resizeRows } = parseResizable(resizable);
  const isResizable = resizeCols || resizeRows;
  const minTrack = minTrackSize ?? TRACK_MIN_PX;

  // Sparse px overrides per axis: `overrides[i]` pins track `i` to px; `null`
  // leaves it sized by its template token (so `fr`/`auto` tracks keep flexing).
  // `null` (the whole array) means "no overrides yet". This replaces the old
  // freeze-the-whole-axis-to-px model, which broke flexible fillers.
  const [colOverrides, setColOverrides] = useState<(number | null)[] | null>(null);
  const [rowOverrides, setRowOverrides] = useState<(number | null)[] | null>(null);
  // Live measured track sizes + gaps, used to position the gutter handles.
  const [measured, setMeasured] = useState<{
    colSizes?: number[];
    rowSizes?: number[];
    colGap: number;
    rowGap: number;
  } | null>(null);

  // Keep a DOM handle for measuring while still honoring the forwarded ref.
  const gridRef = useRef<HTMLElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      gridRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLElement | null }).current = node;
    },
    [ref],
  );

  // Re-measure resolved track sizes + gaps off the live grid. Gutters are always
  // positioned from these, so they stay aligned through content reflow, container
  // resize, and applied overrides.
  const measure = useCallback(() => {
    const grid = gridRef.current;
    if (!isResizable || !grid) return;
    const col = resizeCols ? measureAxis(grid, "col") : null;
    const row = resizeRows ? measureAxis(grid, "row") : null;
    setMeasured({
      colSizes: col?.sizes,
      rowSizes: row?.sizes,
      colGap: col?.gap ?? 0,
      rowGap: row?.gap ?? 0,
    });
  }, [isResizable, resizeCols, resizeRows]);

  // Measure on mount + on container resize (the box change Sigma/window miss).
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!isResizable || !grid) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(grid);
    return () => ro.disconnect();
  }, [isResizable, measure]);

  // Re-measure whenever overrides change: applying an override changes the track
  // layout but NOT the grid's own box, so the ResizeObserver won't fire — measure
  // explicitly so the gutters track the new boundaries (during a drag and after).
  // biome-ignore lint/correctness/useExhaustiveDependencies: colOverrides/rowOverrides are intentional re-run triggers — the effect re-measures after each applied override, it doesn't read them.
  useLayoutEffect(() => {
    measure();
  }, [colOverrides, rowOverrides, measure]);

  // Re-supplying `columns`/`rows` (by content) clears that axis's overrides, so a
  // new template takes effect without remounting.
  const colsKey = columns !== undefined ? JSON.stringify(columns) : "";
  const rowsKey = rows !== undefined ? JSON.stringify(rows) : "";
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset is keyed on the serialized template, not the prop identity — an inline array literal must not wipe a user's drag every render.
  useLayoutEffect(() => {
    setColOverrides(null);
  }, [colsKey]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useLayoutEffect(() => {
    setRowOverrides(null);
  }, [rowsKey]);

  // Move the boundary after track `index` so the LEADING track reaches
  // `desiredLeading` px. The leading track is pinned to px; the trailing track is
  // pinned too ONLY when it's already fixed (preserving a fixed/fixed pair's sum)
  // — when it's flexible (`fr`/`auto`) it's left alone so it stays flush to the
  // container edge and reflows with it. `base` is the px size of every track at
  // the start of the gesture. Returns the resolved px sizes of the two tracks for
  // `onTrackSizesChange`, or `null` if nothing moved.
  const resizeBoundary = useCallback(
    (
      axis: "col" | "row",
      index: number,
      base: number[],
      desiredLeading: number,
    ): number[] | null => {
      const a = base[index];
      const b = base[index + 1];
      if (a == null || b == null) return null;
      const prop = axis === "col" ? columns : rows;
      const tokens = prop !== undefined ? tokenizeTemplate(prop) : [];
      const existing = axis === "col" ? colOverrides : rowOverrides;
      const trailingToken = tokens[index + 1];
      // Treat an unknown/missing token as fixed (safest — pins the pair).
      const trailingFixed =
        existing?.[index + 1] != null ||
        (trailingToken !== undefined ? !isFlexibleToken(trailingToken) : true);
      const trailingMin = trailingFixed ? minTrack : 0;
      const newLeading = Math.max(minTrack, Math.min(desiredLeading, a + b - trailingMin));
      const grow = newLeading - a;
      const next = (existing ?? base.map(() => null)).slice();
      next[index] = newLeading;
      if (trailingFixed) next[index + 1] = b - grow;
      if (axis === "col") setColOverrides(next);
      else setRowOverrides(next);
      const sizes = base.slice();
      sizes[index] = newLeading;
      sizes[index + 1] = b - grow;
      return sizes;
    },
    [columns, rows, colOverrides, rowOverrides, minTrack],
  );

  // The px size of every track right now: override if pinned, else last measured.
  const currentSizes = useCallback(
    (axis: "col" | "row"): number[] => {
      const m = (axis === "col" ? measured?.colSizes : measured?.rowSizes) ?? [];
      const ov = axis === "col" ? colOverrides : rowOverrides;
      return m.map((s, i) => ov?.[i] ?? s);
    },
    [measured, colOverrides, rowOverrides],
  );

  // One drag instance serves every gutter; onStart reads axis + index off the
  // handle, then onMove drives the boundary from the cursor delta.
  const dragRef = useRef<{
    axis: "col" | "row";
    index: number;
    start: number[];
    latest?: number[];
  } | null>(null);
  const { onPointerDown: onGutterDown } = usePointerDrag({
    onStart: (_origin, event) => {
      const grid = gridRef.current;
      const el = event.currentTarget as HTMLElement;
      const axis = el.dataset.axis as "col" | "row" | undefined;
      const index = Number(el.dataset.index);
      if (!grid || !axis || Number.isNaN(index)) return;
      dragRef.current = { axis, index, start: measureAxis(grid, axis).sizes };
    },
    onMove: (delta) => {
      const d = dragRef.current;
      if (!d) return;
      const move = d.axis === "col" ? delta.dx : delta.dy;
      const leadingStart = d.start[d.index];
      if (leadingStart == null) return;
      const sizes = resizeBoundary(d.axis, d.index, d.start, leadingStart + move);
      if (sizes) d.latest = sizes;
    },
    onEnd: () => {
      const d = dragRef.current;
      if (d?.latest) onTrackSizesChange?.(d.axis === "col" ? "columns" : "rows", d.latest);
      dragRef.current = null;
    },
  });

  // Double-click a gutter to reset its two tracks to their template sizing
  // (clears their overrides, restoring `fr`/`auto` flexibility).
  const resetGutter = useCallback(
    (axis: "col" | "row", index: number) => {
      const existing = axis === "col" ? colOverrides : rowOverrides;
      if (!existing) return;
      const next = existing.slice();
      next[index] = null;
      next[index + 1] = null;
      const cleared = next.every((v) => v == null) ? null : next;
      if (axis === "col") setColOverrides(cleared);
      else setRowOverrides(cleared);
      // Report the resolved sizes once the reverted template has laid out.
      const grid = gridRef.current;
      if (grid) {
        requestAnimationFrame(() =>
          onTrackSizesChange?.(axis === "col" ? "columns" : "rows", measureAxis(grid, axis).sizes),
        );
      }
    },
    [colOverrides, rowOverrides, onTrackSizesChange],
  );

  // Keyboard resize on a focused gutter. Arrow keys nudge by a step; Shift larger.
  const resizeGutterByKey = useCallback(
    (axis: "col" | "row", index: number, ev: KeyboardEvent<HTMLDivElement>) => {
      const [dec, inc] = axis === "col" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
      if (ev.key !== dec && ev.key !== inc) return;
      ev.preventDefault();
      const step = (ev.shiftKey ? 24 : 8) * (ev.key === inc ? 1 : -1);
      const base = currentSizes(axis);
      const leading = base[index];
      if (leading == null) return;
      const sizes = resizeBoundary(axis, index, base, leading + step);
      if (sizes) onTrackSizesChange?.(axis === "col" ? "columns" : "rows", sizes);
    },
    [currentSizes, resizeBoundary, onTrackSizesChange],
  );

  const computedStyle = buildGridStyle({
    columns,
    rows,
    areas,
    gap,
    columnGap,
    rowGap,
    flow,
    autoColumns,
    autoRows,
    alignItems,
    justifyItems,
    alignContent,
    justifyContent,
    inline,
  });

  // Apply px overrides over the template, keeping un-pinned tracks flexible.
  const colTemplate = axisTemplate(columns, colOverrides, measured?.colSizes);
  const rowTemplate = axisTemplate(rows, rowOverrides, measured?.rowSizes);
  if (colTemplate) computedStyle.gridTemplateColumns = colTemplate;
  if (rowTemplate) computedStyle.gridTemplateRows = rowTemplate;

  // Gutter overlay — absolutely positioned so it never occupies a grid track.
  // Positioned from the live measured sizes so handles stay on the boundaries
  // through reflow, container resize, and applied overrides.
  const colPos = measured?.colSizes;
  const rowPos = measured?.rowSizes;
  const overlay =
    isResizable && measured ? (
      <div className={styles.gutterLayer} key="sf-gutter-layer">
        {resizeCols && colPos
          ? boundaries(colPos, measured.colGap).map((offset, i) => (
              // biome-ignore lint/a11y/useSemanticElements: a focusable, draggable splitter is not an <hr>
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: gutter index is the stable identity
                key={`col-${i}`}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize column"
                aria-valuenow={Math.round(colPos[i] ?? 0)}
                aria-valuemin={TRACK_MIN_PX}
                tabIndex={0}
                data-axis="col"
                data-index={i}
                className={styles.gutterCol}
                style={{ left: `${offset}px` }}
                onPointerDown={onGutterDown}
                onDoubleClick={() => resetGutter("col", i)}
                onKeyDown={(e) => resizeGutterByKey("col", i, e)}
              />
            ))
          : null}
        {resizeRows && rowPos
          ? boundaries(rowPos, measured.rowGap).map((offset, i) => (
              // biome-ignore lint/a11y/useSemanticElements: a focusable, draggable splitter is not an <hr>
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: gutter index is the stable identity
                key={`row-${i}`}
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize row"
                aria-valuenow={Math.round(rowPos[i] ?? 0)}
                aria-valuemin={TRACK_MIN_PX}
                tabIndex={0}
                data-axis="row"
                data-index={i}
                className={styles.gutterRow}
                style={{ top: `${offset}px` }}
                onPointerDown={onGutterDown}
                onDoubleClick={() => resetGutter("row", i)}
                onKeyDown={(e) => resizeGutterByKey("row", i, e)}
              />
            ))
          : null}
      </div>
    ) : null;

  return useRender({
    render: render ?? <div />,
    props: {
      ...rest,
      ref: setRefs,
      className: cx(
        inline ? styles.gridInline : styles.grid,
        isResizable && styles.resizable,
        className,
      ),
      style: { ...computedStyle, ...style },
      children: overlay ? (
        <>
          {children}
          {overlay}
        </>
      ) : (
        children
      ),
    },
  });
});

const GridItem = forwardRef<HTMLElement, GridItemProps>(function GridItem(props, ref) {
  const {
    area,
    col,
    row,
    colSpan,
    rowSpan,
    alignSelf,
    justifySelf,
    render,
    className,
    style,
    ...rest
  } = props;

  const computedStyle = buildItemStyle({
    area,
    col,
    row,
    colSpan,
    rowSpan,
    alignSelf,
    justifySelf,
  });

  return useRender({
    render: render ?? <div />,
    props: {
      ...rest,
      ref,
      className: cx(styles.item, className),
      style: { ...computedStyle, ...style },
    },
  });
});

type GridComponent = typeof GridRoot & { Item: typeof GridItem };

export const Grid = GridRoot as GridComponent;
Grid.Item = GridItem;
