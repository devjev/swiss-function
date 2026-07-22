import { useRef, useState } from "react";
import type { WindowArrayHandle, WindowMove } from "./WindowArray";
import { WindowArray } from "./WindowArray";

interface HarnessColumn {
  id: string;
  windows: { id: string; title: string }[];
}

function makeColumns(columnCount: number, windowsPerColumn: number): HarnessColumn[] {
  return Array.from({ length: columnCount }, (_, c) => ({
    id: `col-${c + 1}`,
    windows: Array.from({ length: windowsPerColumn }, (_, w) => ({
      id: `w${c + 1}${String.fromCharCode(97 + w)}`,
      title: `Window ${c + 1}${String.fromCharCode(97 + w).toUpperCase()}`,
    })),
  }));
}

/** Apply a `WindowMove` with the documented two-splice convention: remove the
 *  window, drop the source column if that emptied it, then insert — every
 *  `to` index is already relative to that intermediate state. */
export function applyWindowMove<W extends { id: string }>(
  columns: { id: string; windows: W[] }[],
  move: WindowMove,
): { id: string; windows: W[] }[] {
  const next = columns.map((c) => ({ ...c, windows: [...c.windows] }));
  const source = next.find((c) => c.id === move.from.columnId);
  const win = source?.windows.splice(move.from.index, 1)[0];
  if (!source || !win) return columns;
  const after = source.windows.length === 0 ? next.filter((c) => c !== source) : next;
  const to = move.to;
  if (to.type === "cell") {
    const target = after.find((c) => c.id === to.columnId);
    if (!target) return columns;
    target.windows.splice(to.index, 0, win);
  } else {
    after.splice(to.index, 0, { id: `col:${win.id}`, windows: [win] });
  }
  return after;
}

/** Playwright CT mounts top-level components with serializable props. This
 *  owns the column/window state and applies moves/closes, so specs can drag,
 *  close, and keyboard-move against real state updates; the last reported
 *  move and the active id are mirrored into inspectable test nodes. */
export function WindowArrayHarness({
  columnCount = 3,
  windowsPerColumn = 2,
  columnWidth = 220,
  width = 640,
  height = 360,
  snap,
  controls,
  splittable,
  apiHotkeys,
  orientation,
  verticalBelow,
  narrowWidth,
}: {
  columnCount?: number;
  windowsPerColumn?: number;
  columnWidth?: number;
  width?: number;
  height?: number;
  snap?: boolean;
  controls?: boolean;
  splittable?: boolean;
  /** Simulates the consumer's central hotkey system: wires Alt+Arrow on the
   *  wrapping div to `apiRef.switchColumn` (WindowArray binds nothing itself
   *  now — issue #32). */
  apiHotkeys?: boolean;
  orientation?: "auto" | "horizontal" | "vertical";
  verticalBelow?: number;
  /** When set, a "Toggle width" button flips the container between `width`
   *  and this — for collapse→expand round-trip specs (issue #31). */
  narrowWidth?: number;
}) {
  const [columns, setColumns] = useState(() => makeColumns(columnCount, windowsPerColumn));
  const [lastMove, setLastMove] = useState<WindowMove | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [splitIds, setSplitIds] = useState<[string, string] | null>(null);
  const [narrow, setNarrow] = useState(false);
  const effectiveWidth = narrow && narrowWidth != null ? narrowWidth : width;
  const api = useRef<WindowArrayHandle>(null);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: test-only stand-in for a consumer's central hotkey handler.
    <div
      style={{ inlineSize: effectiveWidth, blockSize: height }}
      onKeyDown={
        apiHotkeys
          ? (e) => {
              if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
              if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                api.current?.switchColumn("prev");
              } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                api.current?.switchColumn("next");
              }
            }
          : undefined
      }
    >
      <WindowArray
        aria-label="Harness workspace"
        data-testid="window-array"
        columnMinWidth={120}
        snap={snap}
        controls={controls}
        splittable={splittable}
        onSplitChange={setSplitIds}
        apiRef={api}
        orientation={orientation}
        verticalBelow={verticalBelow}
        onActiveChange={setActiveId}
        onWindowMove={(move) => {
          setLastMove(move);
          setColumns((cols) => applyWindowMove(cols, move));
        }}
      >
        {columns.map((col) => (
          <WindowArray.Column key={col.id} id={col.id} defaultWidth={columnWidth}>
            {col.windows.map((win) => (
              <WindowArray.Window
                key={win.id}
                id={win.id}
                title={win.title}
                onClose={() =>
                  setColumns((cols) =>
                    cols
                      .map((c) => ({ ...c, windows: c.windows.filter((w) => w.id !== win.id) }))
                      .filter((c) => c.windows.length > 0),
                  )
                }
              >
                <p style={{ margin: 0, padding: 8 }}>Body of {win.title}</p>
                {/* Uncontrolled — its DOM value proves content state survives
                    a rearrange (windows are never remounted by moves). */}
                <input aria-label={`Note for ${win.title}`} style={{ margin: 8 }} />
              </WindowArray.Window>
            ))}
          </WindowArray.Column>
        ))}
      </WindowArray>
      <div data-testid="last-move">{lastMove ? JSON.stringify(lastMove) : ""}</div>
      <div data-testid="active-id">{activeId ?? ""}</div>
      <div data-testid="split-ids">{splitIds ? JSON.stringify(splitIds) : ""}</div>
      {narrowWidth != null ? (
        <button type="button" onClick={() => setNarrow((n) => !n)}>
          Toggle width
        </button>
      ) : null}
    </div>
  );
}
