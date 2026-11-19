// Dragging blocks by their bullets, kept in its own module so dnd-kit is
// lazy-loaded (React.lazy + Suspense) and stays out of the Outliner's base
// bundle. Owns its own `DndContext`, or joins an `SfDndProvider` when one
// wraps it (see src/lib/dnd).
//
// The layer is a sibling of the rows and wraps none of them, so the rows do
// not remount when it arrives and a caret in a block survives the load. It
// registers one draggable per row on the row's bullet element and hands the
// row its pointer-down handler through `bind`.
//
// A tree drop has a place and a depth, which dnd-kit's droppables do not
// describe, so there are none: the layer follows the pointer itself, finds the
// gap between two rows under it, and takes the depth from how far right the
// pointer is (`dropTarget`).

import type { DragStartEvent } from "@dnd-kit/core";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import { memo, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../../lib/dnd";
import { measureCssLength } from "../../lib/useCssPx";
import { type DropTarget, dropTarget } from "./drag";
import { subtreeEnd } from "./selection";
import type { BulletId, FlatBullet } from "./types";
import { plainLabel } from "./zoom";

export type BulletPointerDown = (event: ReactPointerEvent<HTMLElement>) => void;

export interface OutlinerDragProps {
  /** The visible rows. */
  rows: FlatBullet[];
  /** The rows that are in the DOM, top to bottom. */
  mounted: BulletId[];
  /** The lowest depth a dropped block may take: 1 while zoomed (the first row
   *  is the title, and nothing becomes its sibling), else 0. */
  floor: number;
  getRoot: () => HTMLElement | null;
  getRow: (id: BulletId) => HTMLElement | undefined;
  /** The blocks a drag from this row's bullet moves: the selection's roots
   *  when the row is selected, else the row. */
  rootsFor: (id: BulletId) => BulletId[];
  /** Hand a row the handler its bullet calls on pointer down. */
  bind: (id: BulletId, handler: BulletPointerDown | null) => void;
  /** The rows being dragged (with their children), or null. */
  onDraggingChange: (ids: ReadonlySet<BulletId> | null) => void;
  onDrop: (roots: BulletId[], target: DropTarget) => void;
  indicatorClassName?: string;
  overlayClassName?: string;
}

interface Line {
  top: number;
  left: number;
}

interface Session {
  roots: BulletId[];
  ids: Set<BulletId>;
  point: { x: number; y: number } | null;
  target: DropTarget | null;
  unit: number;
  indent: number;
  stop: () => void;
}

/** The pointer may leave the rows by this much and still aim at the nearest gap. */
const SLACK = 24;

export default function OutlinerDrag(props: OutlinerDragProps) {
  const { mounted, getRow, bind, indicatorClassName, overlayClassName } = props;
  const shared = useSfDnd();
  const regionId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const live = useRef(props);
  live.current = props;
  const session = useRef<Session | null>(null);
  const [line, setLine] = useState<Line | null>(null);

  /** Where the pointer aims: the place in the tree, and the line that shows it. */
  const locate = (s: Session): { target: DropTarget; line: Line } | null => {
    const { rows, mounted: inDom, floor, getRoot, getRow: rowOf } = live.current;
    const root = getRoot();
    if (!root || !s.point) return null;
    const box = root.getBoundingClientRect();
    const { x, y } = s.point;
    if (x < box.left || x > box.right || y < box.top - SLACK || y > box.bottom + SLACK) return null;

    const rest = rows.filter((r) => !s.ids.has(r.id));
    const indexOf = new Map(rest.map((r, i) => [r.id, i]));
    // The gap: above the first row whose middle is below the pointer.
    let after = -1;
    let edge: number | null = null;
    let rowLeft = box.left;
    for (const id of inDom) {
      const index = indexOf.get(id);
      const rect = index === undefined ? undefined : rowOf(id)?.getBoundingClientRect();
      if (index === undefined || !rect) continue;
      rowLeft = rect.left;
      if (y < rect.top + rect.height / 2) {
        after = index - 1;
        edge = rect.top;
        break;
      }
      after = index;
      edge = rect.bottom;
    }
    if (edge === null) return null;

    // A bullet at depth d is centred one unit past d indent steps.
    const want = Math.round((x - rowLeft - s.unit) / s.indent) + floor;
    const target = dropTarget(
      rest.map((r) => ({
        id: r.id,
        depth: r.depth,
        folded: r.hasChildren && r.bullet.collapsed === true,
      })),
      after,
      want,
      floor,
    );
    if (!target) return null;
    if (target.after !== after) {
      const moved = rest[target.after];
      const rect = moved && rowOf(moved.id)?.getBoundingClientRect();
      if (rect) edge = rect.bottom;
    }
    return {
      target,
      line: {
        top: edge - box.top - root.clientTop,
        left:
          rowLeft - box.left - root.clientLeft + (target.depth - floor) * s.indent + s.unit * 0.75,
      },
    };
  };

  const update = () => {
    const s = session.current;
    if (!s) return;
    const found = locate(s);
    s.target = found?.target ?? null;
    const next = found?.line ?? null;
    setLine((prev) =>
      prev && next && prev.top === next.top && prev.left === next.left ? prev : next,
    );
  };

  const start = (e: DragStartEvent) => {
    const id = (e.active.data.current as { blockId?: BulletId } | undefined)?.blockId;
    const { rows, rootsFor, getRoot, onDraggingChange } = live.current;
    const root = getRoot();
    if (!id || !root) return;
    const roots = rootsFor(id);
    const ids = new Set<BulletId>();
    for (const rootId of roots) {
      const at = rows.findIndex((r) => r.id === rootId);
      if (at < 0) continue;
      for (let k = at; k <= subtreeEnd(rows, at); k++) ids.add((rows[k] as FlatBullet).id);
    }
    const doc = root.ownerDocument;
    const move = (ev: PointerEvent) => {
      const s = session.current;
      if (!s) return;
      s.point = { x: ev.clientX, y: ev.clientY };
      update();
    };
    // The rows move under a still pointer when the page or the outline scrolls.
    const scroll = () => update();
    doc.addEventListener("pointermove", move);
    doc.addEventListener("scroll", scroll, true);
    const press = e.activatorEvent as PointerEvent;
    session.current = {
      roots,
      ids,
      point: typeof press.clientX === "number" ? { x: press.clientX, y: press.clientY } : null,
      target: null,
      unit: measureCssLength(root, "var(--sf-unit)") || 20,
      indent: measureCssLength(root, "var(--sf-outliner-indent)") || 20,
      stop: () => {
        doc.removeEventListener("pointermove", move);
        doc.removeEventListener("scroll", scroll, true);
      },
    };
    root.toggleAttribute("data-block-drag", true);
    onDraggingChange(ids);
    update();
  };

  const finish = (drop: boolean) => {
    const s = session.current;
    if (!s) return;
    s.stop();
    session.current = null;
    setLine(null);
    live.current.getRoot()?.removeAttribute("data-block-drag");
    live.current.onDraggingChange(null);
    if (drop && s.target) live.current.onDrop(s.roots, s.target);
  };

  // A drag in progress when the outline unmounts leaves nothing behind.
  useEffect(() => () => session.current?.stop(), []);

  // The shared provider renders the overlay in its own render pass, ahead of
  // this one, so the label is read through the ref.
  const renderOverlay = (activeId: string): ReactNode => {
    const { rows, rootsFor } = live.current;
    const prefix = `${regionId}:`;
    if (!activeId.startsWith(prefix)) return null;
    const roots = rootsFor(activeId.slice(prefix.length));
    const first = rows.find((r) => r.id === roots[0]);
    if (!first) return null;
    const text = plainLabel(first.bullet.content) || "Empty block";
    return (
      <div className={overlayClassName}>
        {roots.length > 1 ? `${text} and ${roots.length - 1} more` : text}
      </div>
    );
  };

  useSfDndRegion(shared, {
    id: regionId,
    // Only what is under the pointer: a block is dropped on another widget
    // when the pointer is on it, and inside the outline there is nothing to hit.
    collisionDetection: pointerWithin,
    onDragStart: start,
    onDragEnd: () => finish(true),
    onDragCancel: () => finish(false),
    renderOverlay,
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  const body = (
    <>
      {mounted.map((id) => (
        <RowDrag key={id} id={id} regionId={regionId} getRow={getRow} bind={bind} />
      ))}
      {line && (
        <div
          className={indicatorClassName}
          style={{ insetBlockStart: line.top, insetInlineStart: line.left }}
          aria-hidden="true"
        />
      )}
    </>
  );

  if (shared) return body;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => {
        setActiveId(String(e.active.id));
        start(e);
      }}
      onDragEnd={() => {
        setActiveId(null);
        finish(true);
      }}
      onDragCancel={() => {
        setActiveId(null);
        finish(false);
      }}
    >
      {body}
      <DragOverlay dropAnimation={null}>{activeId ? renderOverlay(activeId) : null}</DragOverlay>
    </DndContext>
  );
}

/** One row's draggable: the bullet is the handle and the dragged node. Renders
 *  nothing; the row itself knows nothing of dnd-kit. Memoized, so a keystroke
 *  in the outline does not run one of these per row. */
const RowDrag = memo(function RowDrag({
  id,
  regionId,
  getRow,
  bind,
}: {
  id: BulletId;
  regionId: string;
  getRow: (id: BulletId) => HTMLElement | undefined;
  bind: (id: BulletId, handler: BulletPointerDown | null) => void;
}) {
  // The block id rides in `data`, so another widget that receives the drop can
  // tell which block came.
  const { setNodeRef, listeners } = useDraggable({
    id: `${regionId}:${id}`,
    data: { [SF_REGION_KEY]: regionId, blockId: id },
  });
  const down = listeners?.onPointerDown as BulletPointerDown | undefined;
  const handle = useCallback<BulletPointerDown>(
    (event) => {
      // The node is looked up at the press: the row may have put a new bullet
      // element in the DOM since this component last rendered.
      setNodeRef(getRow(id)?.querySelector<HTMLElement>("[data-bullet-handle]") ?? null);
      down?.(event);
    },
    [down, setNodeRef, getRow, id],
  );
  useLayoutEffect(() => {
    bind(id, handle);
    return () => bind(id, null);
  }, [id, handle, bind]);
  return null;
});
