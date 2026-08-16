import { useCallback, useEffect, useRef, useState } from "react";
import type { Cell, CellRange, Selection } from "./types";

/** What a plain cell click selects. `"row"` / `"col"` widen every cell-driven
 *  range to the full axis (list-style row selection, or column analysis);
 *  explicit gestures (the row-number gutter, header select zones, Cmd/Ctrl+A)
 *  keep their own shapes in every mode. */
export type SelectionMode = "cell" | "row" | "col";

interface UseTableSelectionParams {
  rowCount: number;
  colCount: number;
  mode?: SelectionMode;
  onSelectionChange?: (selection: Selection) => void;
}

interface InternalState {
  active: Cell | null;
  range: CellRange | null;
  anchor: Cell | null;
}

function normalize(a: Cell, b: Cell): CellRange {
  return {
    start: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
    end: { row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) },
  };
}

function inRange(cell: Cell, range: CellRange | null): boolean {
  if (!range) return false;
  return (
    cell.row >= range.start.row &&
    cell.row <= range.end.row &&
    cell.col >= range.start.col &&
    cell.col <= range.end.col
  );
}

function clamp(value: number, max: number): number {
  return Math.max(0, Math.min(value, max - 1));
}

export function useTableSelection({
  rowCount,
  colCount,
  mode = "cell",
  onSelectionChange,
}: UseTableSelectionParams) {
  const [state, setState] = useState<InternalState>({ active: null, range: null, anchor: null });
  const stateRef = useRef(state);
  stateRef.current = state;

  // Widen a cell-driven range to the mode's axis. The anchor/active logic
  // never changes with the mode; only the resulting range's span does.
  const expandRange = useCallback(
    (range: CellRange): CellRange => {
      if (mode === "row") {
        return {
          start: { row: range.start.row, col: 0 },
          end: { row: range.end.row, col: colCount - 1 },
        };
      }
      if (mode === "col") {
        return {
          start: { row: 0, col: range.start.col },
          end: { row: rowCount - 1, col: range.end.col },
        };
      }
      return range;
    },
    [mode, rowCount, colCount],
  );

  // Tracks whether a pointer drag started inside the table and hasn't ended.
  // A ref (not state) so cell-to-cell pointerenter doesn't trigger a re-render
  // beyond the actual selection change.
  const isDraggingRef = useRef(false);

  // What the drag started on. A drag from a row-number cell keeps selecting
  // whole rows and one from a column-header zone whole columns, no matter what
  // the cursor later crosses (Excel's gesture); a cell drag rubber-bands cells.
  const dragModeRef = useRef<"cell" | "row" | "col">("cell");

  // Global pointerup clears the drag flag — works even if the user releases
  // outside the table (or outside the document, via pointercancel).
  useEffect(() => {
    const end = () => {
      isDraggingRef.current = false;
      dragModeRef.current = "cell";
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, []);

  // Notify on change — compare to last notified selection to avoid loops.
  const lastNotified = useRef<Selection>({ active: null, range: null });
  useEffect(() => {
    const next: Selection = { active: state.active, range: state.range };
    if (
      next.active?.row === lastNotified.current.active?.row &&
      next.active?.col === lastNotified.current.active?.col &&
      JSON.stringify(next.range) === JSON.stringify(lastNotified.current.range)
    ) {
      return;
    }
    lastNotified.current = next;
    onSelectionChange?.(next);
  }, [state, onSelectionChange]);

  const setActive = useCallback(
    (cell: Cell | null) => {
      // In row/col mode a single activation already carries a full-axis range
      // (the "click a cell, get the row" behavior); cell mode keeps range null.
      const range = cell && mode !== "cell" ? expandRange({ start: cell, end: cell }) : null;
      setState({ active: cell, range, anchor: cell });
    },
    [mode, expandRange],
  );

  const extendTo = useCallback(
    (cell: Cell) => {
      setState((prev) => {
        const anchor = prev.anchor ?? prev.active ?? cell;
        return {
          active: cell,
          range: expandRange(normalize(anchor, cell)),
          anchor,
        };
      });
    },
    [expandRange],
  );

  // Extend to `row`, keeping the full column span — the row-selection sibling
  // of `extendTo`. The anchor pins the first-selected row; the active cell
  // stays at the anchor (Excel keeps it on the clicked row header's first cell).
  const extendRowTo = useCallback(
    (row: number) => {
      setState((prev) => {
        const anchorRow = prev.anchor?.row ?? row;
        const anchor = { row: anchorRow, col: 0 };
        return {
          active: anchor,
          anchor,
          range: normalize({ row: anchorRow, col: 0 }, { row, col: colCount - 1 }),
        };
      });
    },
    [colCount],
  );

  // Extend to `col`, keeping the full row span — the column sibling.
  const extendColTo = useCallback(
    (col: number) => {
      setState((prev) => {
        const anchorCol = prev.anchor?.col ?? col;
        const anchor = { row: 0, col: anchorCol };
        return {
          active: anchor,
          anchor,
          range: normalize({ row: 0, col: anchorCol }, { row: rowCount - 1, col }),
        };
      });
    },
    [rowCount],
  );

  const handleCellPointerDown = useCallback(
    (cell: Cell, ev: { shiftKey: boolean }) => {
      if (ev.shiftKey && stateRef.current.active) {
        extendTo(cell);
      } else {
        setActive(cell);
      }
      isDraggingRef.current = true;
      dragModeRef.current = "cell";
    },
    [setActive, extendTo],
  );

  // Called as the cursor crosses into a cell while a drag is in progress.
  // Extends the range from the anchor (set by the initial pointerdown) to
  // the cell currently under the cursor — spreadsheet-style rubber-banding.
  // A drag that started on a row-number / column-header keeps its full-span
  // shape and only tracks the cursor's row / column.
  const handleCellPointerEnter = useCallback(
    (cell: Cell) => {
      if (!isDraggingRef.current) return;
      if (dragModeRef.current === "row") extendRowTo(cell.row);
      else if (dragModeRef.current === "col") extendColTo(cell.col);
      else extendTo(cell);
    },
    [extendTo, extendRowTo, extendColTo],
  );

  // Row-number gutter: click selects the whole row, Shift+click extends the
  // row span from the anchor, drag sweeps a span of rows.
  const handleRowHeaderPointerDown = useCallback(
    (row: number, ev: { shiftKey: boolean }) => {
      if (!(ev.shiftKey && stateRef.current.anchor)) {
        setState({ active: { row, col: 0 }, anchor: { row, col: 0 }, range: null });
      }
      extendRowTo(row);
      isDraggingRef.current = true;
      dragModeRef.current = "row";
    },
    [extendRowTo],
  );

  const handleRowHeaderPointerEnter = useCallback(
    (row: number) => {
      if (!isDraggingRef.current || dragModeRef.current !== "row") return;
      extendRowTo(row);
    },
    [extendRowTo],
  );

  // Column-header select zone: the column analogue of the gutter handlers.
  const handleColumnHeaderPointerDown = useCallback(
    (col: number, ev: { shiftKey: boolean }) => {
      if (!(ev.shiftKey && stateRef.current.anchor)) {
        setState({ active: { row: 0, col }, anchor: { row: 0, col }, range: null });
      }
      extendColTo(col);
      isDraggingRef.current = true;
      dragModeRef.current = "col";
    },
    [extendColTo],
  );

  const handleColumnHeaderPointerEnter = useCallback(
    (col: number) => {
      if (!isDraggingRef.current || dragModeRef.current !== "col") return;
      extendColTo(col);
    },
    [extendColTo],
  );

  // The select-all corner (and Cmd/Ctrl+A share this shape).
  const selectAll = useCallback(() => {
    if (rowCount === 0 || colCount === 0) return;
    const anchor = stateRef.current.active ?? { row: 0, col: 0 };
    setState({
      active: anchor,
      anchor,
      range: {
        start: { row: 0, col: 0 },
        end: { row: rowCount - 1, col: colCount - 1 },
      },
    });
  }, [rowCount, colCount]);

  const handleKeyDown = useCallback(
    (ev: KeyboardEvent) => {
      const { active } = stateRef.current;
      if (!active) return;

      const isMeta = ev.metaKey || ev.ctrlKey;

      // Select all
      if (isMeta && ev.key.toLowerCase() === "a") {
        ev.preventDefault();
        selectAll();
        return;
      }

      // Excel: Shift+Space selects the whole row(s), Ctrl+Space the whole
      // column(s). The current range's span widens to the full axis; the
      // active cell and anchor stay where they are.
      if (ev.key === " " && ev.shiftKey && !isMeta) {
        ev.preventDefault();
        setState((prev) => {
          const a = prev.active;
          if (!a) return prev;
          return {
            ...prev,
            range: {
              start: { row: Math.min(prev.range?.start.row ?? a.row, a.row), col: 0 },
              end: { row: Math.max(prev.range?.end.row ?? a.row, a.row), col: colCount - 1 },
            },
          };
        });
        return;
      }
      if (ev.key === " " && isMeta && !ev.shiftKey) {
        ev.preventDefault();
        setState((prev) => {
          const a = prev.active;
          if (!a) return prev;
          return {
            ...prev,
            range: {
              start: { row: 0, col: Math.min(prev.range?.start.col ?? a.col, a.col) },
              end: { row: rowCount - 1, col: Math.max(prev.range?.end.col ?? a.col, a.col) },
            },
          };
        });
        return;
      }

      if (ev.key === "Escape") {
        ev.preventDefault();
        setState((prev) => ({ ...prev, range: null, anchor: prev.active }));
        return;
      }

      // Tab navigates horizontally and wraps to the next/previous row at the
      // edges — Excel convention. Shift extends range only for arrow keys;
      // Tab/Enter always move the active cell (no range extension).
      if (ev.key === "Tab") {
        ev.preventDefault();
        const dir = ev.shiftKey ? -1 : 1;
        let nextCol = active.col + dir;
        let nextRow = active.row;
        if (nextCol >= colCount) {
          nextCol = 0;
          nextRow = Math.min(active.row + 1, rowCount - 1);
        } else if (nextCol < 0) {
          nextCol = colCount - 1;
          nextRow = Math.max(active.row - 1, 0);
        }
        setActive({ row: nextRow, col: nextCol });
        return;
      }

      let dRow = 0;
      let dCol = 0;
      switch (ev.key) {
        case "ArrowUp":
          dRow = -1;
          break;
        case "ArrowDown":
          dRow = 1;
          break;
        case "ArrowLeft":
          dCol = -1;
          break;
        case "ArrowRight":
          dCol = 1;
          break;
        case "Enter":
          // Excel: Enter moves down (Shift+Enter moves up) when not editing.
          // (Edit-trigger Enter is intercepted by DataTable before this hook sees it.)
          dRow = ev.shiftKey ? -1 : 1;
          break;
        default:
          return;
      }

      ev.preventDefault();
      const next: Cell = {
        row: clamp(active.row + dRow, rowCount),
        col: clamp(active.col + dCol, colCount),
      };

      if (ev.shiftKey && ev.key.startsWith("Arrow")) {
        extendTo(next);
      } else {
        setActive(next);
      }
    },
    [rowCount, colCount, setActive, extendTo, selectAll],
  );

  const clear = useCallback(() => {
    setState({ active: null, range: null, anchor: null });
  }, []);

  return {
    selection: { active: state.active, range: state.range } as Selection,
    isActive: (cell: Cell) => state.active?.row === cell.row && state.active?.col === cell.col,
    isInRange: (cell: Cell) => inRange(cell, state.range),
    handleCellPointerDown,
    handleCellPointerEnter,
    handleRowHeaderPointerDown,
    handleRowHeaderPointerEnter,
    handleColumnHeaderPointerDown,
    handleColumnHeaderPointerEnter,
    selectAll,
    handleKeyDown,
    setActive,
    clear,
  };
}
