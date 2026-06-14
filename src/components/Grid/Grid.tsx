import { useRender } from "@base-ui/react/use-render";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useCallback, useRef, useState } from "react";
import { cx } from "../../lib/cx";
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
    render,
    className,
    style,
    ...rest
  } = props;

  const { cols: resizeCols, rows: resizeRows } = parseResizable(resizable);
  const isResizable = resizeCols || resizeRows;

  // Frozen px track sizes per axis (null until the first resize freezes them).
  const [colSizes, setColSizes] = useState<number[] | null>(null);
  const [rowSizes, setRowSizes] = useState<number[] | null>(null);

  // Keep a DOM handle for measuring/freezing while still honoring the forwarded ref.
  const gridRef = useRef<HTMLElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      gridRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: HTMLElement | null }).current = node;
    },
    [ref],
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

  // Once an axis is frozen, drive it from explicit px tracks.
  if (colSizes) computedStyle.gridTemplateColumns = colSizes.map((s) => `${s}px`).join(" ");
  if (rowSizes) computedStyle.gridTemplateRows = rowSizes.map((s) => `${s}px`).join(" ");

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
