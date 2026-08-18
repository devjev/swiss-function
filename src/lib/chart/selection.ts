/** Click-to-freeze selection for the 2D charts (Scatterplot, CandlestickChart,
 *  BarChart, BridgeChart, Heatmap).
 *
 *  Clicking a mark pins it: the chart freezes that mark's datum as the
 *  selection and opens a popover anchored to it (see `SelectionPopover`). The
 *  anchor is re-derived from the mark's data coordinates through the live
 *  scales every render, so the popover tracks the mark through zoom / pan /
 *  resize for free. This module owns only the controlled/uncontrolled state;
 *  each chart wires its own activate handler and anchor geometry (the datum
 *  shape and hit-testing are chart-specific).
 */

import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

/** The selection prop surface a chart mixes in. `D` is the chart's
 *  datum-with-series shape (the same object its activate callback emits), so a
 *  `selection` round-trips through the consumer unchanged. */
export interface ChartSelectionProps<D> {
  /** Enable click-to-freeze selection: a click on a mark pins it and opens a
   *  popover anchored to it that tracks the mark through zoom/pan. Off by
   *  default, so existing activate-only consumers are unaffected. */
  selectable?: boolean;
  /** The pinned selection (controlled), or `null` for none. Omit for
   *  uncontrolled selection. */
  selection?: D | null;
  /** Uncontrolled initial selection. Default `null`. */
  defaultSelection?: D | null;
  /** Fired when the pinned selection changes — a click pins or toggles it, or a
   *  dismissal (outside press, Escape, the popover's close button) clears it. */
  onSelectionChange?: (selection: D | null) => void;
  /** Popover body for the pinned mark. Defaults to the chart's `renderTooltip`,
   *  so pinning works with no extra config; provide it for richer or
   *  interactive content (links, buttons). */
  renderSelection?: (selection: D) => ReactNode;
}

/** Manage the pinned selection, controlled or uncontrolled. `setSelection` is
 *  referentially stable (it reads controlled-ness and the callback through
 *  refs), so it can be threaded into a chart's memoized mark layer without
 *  breaking the hover-render bail-out. */
export function useChartSelection<D>(props: ChartSelectionProps<D>): {
  selection: D | null;
  setSelection: (next: D | null) => void;
} {
  const controlled = props.selection !== undefined;
  const [uncontrolled, setUncontrolled] = useState<D | null>(() => props.defaultSelection ?? null);
  const selection = controlled ? (props.selection ?? null) : uncontrolled;

  const controlledRef = useRef(controlled);
  controlledRef.current = controlled;
  const onChangeRef = useRef(props.onSelectionChange);
  onChangeRef.current = props.onSelectionChange;

  const setSelection = useCallback((next: D | null) => {
    if (!controlledRef.current) setUncontrolled(next);
    onChangeRef.current?.(next);
  }, []);

  return { selection, setSelection };
}
