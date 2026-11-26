import type { FlatBullet } from "./types";

/** The commands of the touch toolbar, in the order of its keys. Each is what
 *  a keyboard chord does in a block's text: Shift+Tab, Tab, Alt+Shift+Up,
 *  Alt+Shift+Down, Mod+Enter, Mod+Z, Mod+Shift+Z and Escape. */
export type OutlinerCommand =
  | "outdent"
  | "indent"
  | "moveUp"
  | "moveDown"
  | "task"
  | "undo"
  | "redo"
  | "done";

/** The part of `window.visualViewport` the toolbar reads. */
export interface ViewportRect {
  offsetTop: number;
  height: number;
}

/**
 * How far above the bottom of the layout viewport the visible part of the page
 * ends, in px: the height an on-screen keyboard covers. A `position: fixed`
 * bar with this as its `bottom` sits directly above the keyboard.
 *
 * `layoutHeight` is `window.innerHeight`. Without the Visual Viewport API
 * (`viewport` is null or undefined) the answer is 0: the bar sits on the
 * bottom edge of the window.
 */
export function keyboardInset(
  layoutHeight: number,
  viewport: ViewportRect | null | undefined,
): number {
  if (!viewport) return 0;
  const hidden = layoutHeight - (viewport.offsetTop + viewport.height);
  // Whole pixels: a fractional viewport height (a zoomed page, a display
  // scale of 2.625) would otherwise leave a hairline under the bar.
  return Number.isFinite(hidden) ? Math.max(0, Math.round(hidden)) : 0;
}

/** Which of the structure commands would change the tree. */
export interface StructureMoves {
  outdent: boolean;
  indent: boolean;
  moveUp: boolean;
  moveDown: boolean;
}

const NO_MOVES: StructureMoves = { outdent: false, indent: false, moveUp: false, moveDown: false };

/**
 * Whether the block at `at` in the visible rows can be outdented, indented and
 * moved, read from the rows alone (no pass over the tree). It answers what
 * `outdent`, `indent`, `moveUp` and `moveDown` in tree.ts would do: each of
 * those returns the tree unchanged exactly when the answer here is false.
 *
 * `zoomed` says the rows are the view of a zoomed block: the first row is its
 * title, and a block may not leave it, so the title's children do not outdent.
 */
export function structureMoves(
  rows: readonly FlatBullet[],
  at: number,
  zoomed: boolean,
): StructureMoves {
  const row = rows[at];
  if (!row) return NO_MOVES;
  // The parent is the nearest row above with a smaller depth.
  let parent: FlatBullet | undefined;
  for (let i = at - 1; i >= 0 && row.depth > 0; i--) {
    const above = rows[i];
    if (above && above.depth < row.depth) {
      parent = above;
      break;
    }
  }
  const first = row.index === 0;
  const last = row.index === row.siblings - 1;
  return {
    outdent: row.depth > (zoomed ? 1 : 0),
    indent: !first,
    // Past the first or the last sibling the block enters the parent's
    // neighbour, when the parent has one.
    moveUp: !first || (parent !== undefined && parent.index > 0),
    moveDown: !last || (parent !== undefined && parent.index < parent.siblings - 1),
  };
}
