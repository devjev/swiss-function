/** Names for places on the unit grid. A cell is a square of the grid; rows and
 *  columns count from 1 at the top left of the covered region, row first:
 *  `3:2` is the third row, second column. A range is two cells joined by a
 *  hyphen, `3:2-5:10`, from the top-left cell to the bottom-right cell, both
 *  included. Pure, so it is tested on its own. */

export interface GridCell {
  row: number;
  col: number;
}

export interface GridRange {
  /** The top-left cell. */
  from: GridCell;
  /** The bottom-right cell. */
  to: GridCell;
}

/** The cell under a point, `x` and `y` in px from the region's top left, for
 *  cells `size` px square. */
export function cellAt(x: number, y: number, size: number): GridCell {
  return { row: Math.floor(y / size) + 1, col: Math.floor(x / size) + 1 };
}

/** The range two cells span, whichever corner each is. */
export function rangeOf(a: GridCell, b: GridCell): GridRange {
  return {
    from: { row: Math.min(a.row, b.row), col: Math.min(a.col, b.col) },
    to: { row: Math.max(a.row, b.row), col: Math.max(a.col, b.col) },
  };
}

export function formatCell(cell: GridCell): string {
  return `${cell.row}:${cell.col}`;
}

/** `3:2` for one cell, `3:2-5:10` for more. */
export function formatRange(range: GridRange): string {
  const one = range.from.row === range.to.row && range.from.col === range.to.col;
  return one ? formatCell(range.from) : `${formatCell(range.from)}-${formatCell(range.to)}`;
}

/** Rows and columns a range covers. */
export function rangeSize(range: GridRange): { rows: number; cols: number } {
  return {
    rows: range.to.row - range.from.row + 1,
    cols: range.to.col - range.from.col + 1,
  };
}

const CELL = /^\s*(\d+)\s*:\s*(\d+)\s*$/;

/** Read `3:2` or `3:2-5:10` (spaces allowed, either corner first). `null`
 *  for anything else, or for a row or column under 1. */
export function parseRange(text: string): GridRange | null {
  const parts = text.split("-");
  if (parts.length < 1 || parts.length > 2) return null;
  const cells: GridCell[] = [];
  for (const part of parts) {
    const m = CELL.exec(part);
    if (!m) return null;
    const cell = { row: Number(m[1]), col: Number(m[2]) };
    if (cell.row < 1 || cell.col < 1) return null;
    cells.push(cell);
  }
  const [a, b = a] = cells as [GridCell, GridCell?];
  return rangeOf(a, b as GridCell);
}

/** A range's box in px from the region's top left, for cells `size` px
 *  square. */
export function rangeBox(
  range: GridRange,
  size: number,
): { left: number; top: number; width: number; height: number } {
  const { rows, cols } = rangeSize(range);
  return {
    left: (range.from.col - 1) * size,
    top: (range.from.row - 1) * size,
    width: cols * size,
    height: rows * size,
  };
}
