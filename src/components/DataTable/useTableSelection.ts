import { useCallback, useEffect, useRef, useState } from "react";
import type { Cell, CellRange, Selection } from "./types";

interface UseTableSelectionParams {
  rowCount: number;
  colCount: number;
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
  onSelectionChange,
}: UseTableSelectionParams) {
  const [state, setState] = useState<InternalState>({ active: null, range: null, anchor: null });
  const stateRef = useRef(state);
  stateRef.current = state;

  // Tracks whether a pointer drag started inside the table and hasn't ended.
  // A ref (not state) so cell-to-cell pointerenter doesn't trigger a re-render
  // beyond the actual selection change.
  const isDraggingRef = useRef(false);

  // Global pointerup clears the drag flag — works even if the user releases
  // outside the table (or outside the document, via pointercancel).
  useEffect(() => {
    const end = () => {
      isDraggingRef.current = false;
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

  const setActive = useCallback((cell: Cell | null) => {
    setState({ active: cell, range: null, anchor: cell });
  }, []);

  const extendTo = useCallback((cell: Cell) => {
    setState((prev) => {
      const anchor = prev.anchor ?? prev.active ?? cell;
      return {
        active: cell,
        range: normalize(anchor, cell),
        anchor,
      };
    });
  }, []);

  const handleCellPointerDown = useCallback(
    (cell: Cell, ev: { shiftKey: boolean }) => {
      if (ev.shiftKey && stateRef.current.active) {
        extendTo(cell);
      } else {
        setActive(cell);
      }
      isDraggingRef.current = true;
    },
    [setActive, extendTo],
  );

  // Called as the cursor crosses into a cell while a drag is in progress.
  // Extends the range from the anchor (set by the initial pointerdown) to
  // the cell currently under the cursor — spreadsheet-style rubber-banding.
  const handleCellPointerEnter = useCallback(
    (cell: Cell) => {
      if (!isDraggingRef.current) return;
      extendTo(cell);
    },
    [extendTo],
  );

  const handleKeyDown = useCallback(
    (ev: KeyboardEvent) => {
      const { active } = stateRef.current;
      if (!active) return;

      const isMeta = ev.metaKey || ev.ctrlKey;

      // Select all
      if (isMeta && ev.key.toLowerCase() === "a") {
        ev.preventDefault();
        const anchor = stateRef.current.active ?? { row: 0, col: 0 };
        setState({
          active: anchor,
          anchor,
          range: {
            start: { row: 0, col: 0 },
            end: { row: rowCount - 1, col: colCount - 1 },
          },
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
    [rowCount, colCount, setActive, extendTo],
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
    handleKeyDown,
    setActive,
    clear,
  };
}
