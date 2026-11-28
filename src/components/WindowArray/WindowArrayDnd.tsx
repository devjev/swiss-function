// Drag-rearrange for WindowArray, in its own module so dnd-kit is loaded only
// when a window can be moved by drag (`onWindowMove`) or the strip can take
// drops from the host (under an `SfDndProvider`; issue #93). Load it through
// `loadWindowArrayDnd`.
//
// The layer is a sibling of the strip and wraps none of it, so no window (nor
// the content in it) remounts when it arrives. It registers a draggable and a
// droppable per window, a droppable per gutter and per column backdrop, binds
// them to the elements the strip reports to `nodes`, and leaves each window's
// activator listeners there for its title-bar handle to call. Owns a
// `DndContext` by default; under an `SfDndProvider` it registers the strip as a
// region of the shared context.

import type {
  CollisionDetection,
  DragEndEvent,
  DragMoveEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import { memo, type ReactNode, useLayoutEffect } from "react";
import { SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../../lib/dnd/context";
import type { DragNodes } from "../../lib/dnd/nodes";
import { useSfSensors } from "../../lib/dnd/sensors";

/** A drop target on the strip, or a window, as the layer registers it. `key`
 *  names its element in `nodes`. */
export type WindowArrayDndTarget =
  /** A gap between columns: a drop there breaks the window out into a new
   *  column at `index`. */
  | { kind: "gap"; key: string; index: number }
  /** A column's backdrop: the drop target of an empty column (an occupied
   *  column defers to its windows). */
  | { kind: "column"; key: string; columnId: string; empty: boolean }
  /** A window: draggable by its title bar, and a drop target that inserts
   *  before or after it. `row` is its index in its column. */
  | { kind: "window"; key: string; id: string; columnId: string; row: number; draggable: boolean };

export interface WindowArrayDndProps {
  regionId: string;
  /** In the strip's order (collision ties resolve in registration order). */
  targets: WindowArrayDndTarget[];
  nodes: DragNodes;
  onDragStart: (e: DragStartEvent) => void;
  onDragMove: (e: DragMoveEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
  onDragCancel: () => void;
  /** A foreign item dropped on a window, an empty column or a gap (shared
   *  provider only). */
  onExternalDrop: (e: DragEndEvent) => void;
  /** The shared provider's overlay for a dragged window, by window id. */
  renderOverlay: (activeId: string) => ReactNode;
  /** The own context's overlay: the window being dragged, or nothing. */
  overlay: ReactNode;
}

/** The target under the pointer, else the nearest one. */
const collisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

export function WindowArrayDnd({
  regionId,
  targets,
  nodes,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
  onExternalDrop,
  renderOverlay,
  overlay,
}: WindowArrayDndProps) {
  const shared = useSfDnd();
  const sensors = useSfSensors();
  useSfDndRegion(shared, {
    id: regionId,
    collisionDetection,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    onExternalDrop,
    renderOverlay,
  });

  const bindings = targets.map((target) => {
    switch (target.kind) {
      case "gap":
        return (
          <GapBinding
            key={target.key}
            nodeKey={target.key}
            regionId={regionId}
            index={target.index}
            nodes={nodes}
          />
        );
      case "column":
        return (
          <ColumnBinding
            key={target.key}
            nodeKey={target.key}
            regionId={regionId}
            columnId={target.columnId}
            empty={target.empty}
            nodes={nodes}
          />
        );
      default:
        return (
          <WindowBinding
            key={target.key}
            nodeKey={target.key}
            regionId={regionId}
            id={target.id}
            columnId={target.columnId}
            row={target.row}
            draggable={target.draggable}
            nodes={nodes}
          />
        );
    }
  });
  // Under a shared provider the DndContext and DragOverlay are the provider's.
  if (shared) return bindings;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
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

// Droppable and draggable ids are region-prefixed: dnd-kit's registries are
// id-keyed, so two WindowArrays under one SfDndProvider would clobber each
// other's targets on bare ids. Routing reads the data, never parses the id.

const GapBinding = memo(function GapBinding({
  nodeKey,
  regionId,
  index,
  nodes,
}: {
  nodeKey: string;
  regionId: string;
  index: number;
  nodes: DragNodes;
}) {
  const { setNodeRef } = useDroppable({
    id: `${regionId}:gap-${index}`,
    data: { [SF_REGION_KEY]: regionId, gapIndex: index },
  });
  useLayoutEffect(() => nodes.bind(nodeKey, setNodeRef), [nodes, nodeKey, setNodeRef]);
  return null;
});

const ColumnBinding = memo(function ColumnBinding({
  nodeKey,
  regionId,
  columnId,
  empty,
  nodes,
}: {
  nodeKey: string;
  regionId: string;
  columnId: string;
  empty: boolean;
  nodes: DragNodes;
}) {
  const { setNodeRef } = useDroppable({
    id: `${regionId}:col-${columnId}`,
    data: { [SF_REGION_KEY]: regionId, columnId, row: null },
    disabled: !empty,
  });
  useLayoutEffect(() => nodes.bind(nodeKey, setNodeRef), [nodes, nodeKey, setNodeRef]);
  return null;
});

const WindowBinding = memo(function WindowBinding({
  nodeKey,
  regionId,
  id,
  columnId,
  row,
  draggable,
  nodes,
}: {
  nodeKey: string;
  regionId: string;
  id: string;
  columnId: string;
  row: number;
  draggable: boolean;
  nodes: DragNodes;
}) {
  const drag = useDraggable({
    id,
    disabled: !draggable,
    data: { [SF_REGION_KEY]: regionId },
  });
  const drop = useDroppable({
    id: `${regionId}:win-${id}`,
    data: { [SF_REGION_KEY]: regionId, columnId, row },
  });
  const setDragNode = drag.setNodeRef;
  const setDropNode = drop.setNodeRef;
  useLayoutEffect(
    () =>
      nodes.bind(nodeKey, (el) => {
        setDragNode(el);
        setDropNode(el);
      }),
    [nodes, nodeKey, setDragNode, setDropNode],
  );
  // The title-bar handle calls these from its own pointer handlers.
  const { listeners } = drag;
  useLayoutEffect(() => nodes.setListeners(nodeKey, listeners), [nodes, nodeKey, listeners]);
  useLayoutEffect(() => () => nodes.setListeners(nodeKey, undefined), [nodes, nodeKey]);
  return null;
});
