// Row drag-and-drop for Explorer, in its own module so dnd-kit is loaded only
// when a row can be dragged or dropped on (`editable`, or under an
// `SfDndProvider`; issue #93). Load it through `loadExplorerDnd`.
//
// The layer is a sibling of the rows and wraps none of them, so the tree does
// not remount when it arrives. It registers one draggable and one droppable per
// visible row, plus the viewport as a droppable, binds them to the elements the
// rows report to `nodes`, and leaves each row's activator listeners there for
// the row's own pointer handlers to call. Owns a `DndContext` by default; under
// an `SfDndProvider` it registers the tree as a region of the shared context.

import type { DragEndEvent, DragMoveEvent, DragStartEvent } from "@dnd-kit/core";
import { DndContext, DragOverlay, useDraggable, useDroppable } from "@dnd-kit/core";
import { memo, type ReactNode, type RefObject, useLayoutEffect, useMemo } from "react";
import { excludeRegionCollision } from "../../lib/dnd/collision";
import { SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../../lib/dnd/context";
import type { DragNodes } from "../../lib/dnd/nodes";
import { useSfSensors } from "../../lib/dnd/sensors";

/** A visible row, as the layer registers it. */
export interface ExplorerDndRow {
  /** The node id; also the row's key in `nodes`. */
  id: string;
  /** The row's index among the visible rows (the drop target's position). */
  rowIndex: number;
  /** Whether a drag may start on this row (editable, unsorted, not renaming). */
  draggable: boolean;
}

export interface ExplorerDndProps {
  /** The tree's region id; also the prefix of every row's dnd id. */
  treeRegionId: string;
  /** The column headers' region id, whose droppables tree drags ignore. */
  colRegionId: string;
  rows: ExplorerDndRow[];
  nodes: DragNodes;
  viewportRef: RefObject<HTMLDivElement | null>;
  /** The viewport takes a drop (append to the root) only while one of this
   *  tree's rows is dragged. */
  viewportDroppable: boolean;
  onDragStart: (e: DragStartEvent) => void;
  onDragMove: (e: DragMoveEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
  onDragCancel: () => void;
  /** A foreign item dropped on a row (shared provider only). */
  onExternalDrop: (e: DragEndEvent) => void;
  /** The shared provider's overlay for a dragged row, by dnd id. */
  renderOverlay: (activeId: string) => ReactNode;
  /** The own context's overlay: the row being dragged, or nothing. */
  overlay: ReactNode;
}

export function ExplorerDnd({
  treeRegionId,
  colRegionId,
  rows,
  nodes,
  viewportRef,
  viewportDroppable,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onExternalDrop,
  renderOverlay,
  overlay,
}: ExplorerDndProps) {
  const shared = useSfDnd();
  const sensors = useSfSensors();
  // The tree's collisions ignore the header droppables, so the two regions of
  // one instance never cross-talk (a row drag can't land on a header).
  const collisionDetection = useMemo(() => excludeRegionCollision(colRegionId), [colRegionId]);
  useSfDndRegion(shared, {
    id: treeRegionId,
    collisionDetection,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    onExternalDrop,
    renderOverlay,
  });

  const bindings = (
    <>
      <ViewportBinding
        regionId={treeRegionId}
        viewportRef={viewportRef}
        disabled={!viewportDroppable}
      />
      {rows.map((row) => (
        <RowBinding
          key={row.id}
          id={row.id}
          rowIndex={row.rowIndex}
          draggable={row.draggable}
          regionId={treeRegionId}
          nodes={nodes}
        />
      ))}
    </>
  );
  // Under a shared provider the DndContext and DragOverlay are the provider's.
  if (shared) return bindings;
  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {bindings}
      <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
    </DndContext>
  );
}

/** One row's draggable and droppable, bound to the row element. Dnd ids are
 *  namespaced per region so two Explorer instances under one `SfDndProvider`
 *  can't collide; the real node id travels in the data. */
const RowBinding = memo(function RowBinding({
  id,
  rowIndex,
  draggable,
  regionId,
  nodes,
}: {
  id: string;
  rowIndex: number;
  draggable: boolean;
  regionId: string;
  nodes: DragNodes;
}) {
  const drag = useDraggable({
    id: `${regionId}:${id}`,
    disabled: !draggable,
    data: { [SF_REGION_KEY]: regionId, nodeId: id },
  });
  const drop = useDroppable({
    id: `${regionId}:row-${id}`,
    data: { [SF_REGION_KEY]: regionId, rowIndex },
  });
  const setDragNode = drag.setNodeRef;
  const setDropNode = drop.setNodeRef;
  useLayoutEffect(
    () =>
      nodes.bind(id, (el) => {
        setDragNode(el);
        setDropNode(el);
      }),
    [nodes, id, setDragNode, setDropNode],
  );
  // The row calls `onPointerDown` (the pointer sensor) and `onTouchStart` (the
  // touch sensor) from its own handlers.
  const { listeners } = drag;
  useLayoutEffect(() => nodes.setListeners(id, listeners), [nodes, id, listeners]);
  useLayoutEffect(() => () => nodes.setListeners(id, undefined), [nodes, id]);
  return null;
});

/** The scroll viewport as a droppable, so a drop inside the tree but below the
 *  last row appends to the root.
 *
 *  Disabled unless one of THIS tree's rows is being dragged: the viewport rect
 *  spans the whole tree, so under closestCenter (foreign drags, whose collision
 *  detection this widget does not own) its center would outrank a row's center
 *  for drops near the tree's vertical middle and steal row-targeted drops. */
function ViewportBinding({
  regionId,
  viewportRef,
  disabled,
}: {
  regionId: string;
  viewportRef: RefObject<HTMLDivElement | null>;
  disabled: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: `${regionId}:viewport`,
    disabled,
    data: { [SF_REGION_KEY]: regionId, viewport: true },
  });
  // The layer renders after the viewport, so the element is in place. Attach
  // once per mount: setNodeRef is identity-stable, and re-attaching per render
  // would re-fire dnd-kit's node-change handler (a rect recompute).
  useLayoutEffect(() => {
    setNodeRef(viewportRef.current);
    return () => setNodeRef(null);
  }, [setNodeRef, viewportRef]);
  return null;
}
