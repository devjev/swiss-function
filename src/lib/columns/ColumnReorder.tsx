/** Drag-to-reorder for the column headers of DataTable and Explorer (issue
 *  #28), in its own module so dnd-kit is loaded only with `reorderableColumns`
 *  (issue #93; load it through `loadColumnReorder`).
 *
 *  The layer is a sibling of the header cells and wraps none of them, so the
 *  headers do not remount when it arrives (a focused resize handle keeps its
 *  focus). It registers one sortable per reorderable header and binds it to
 *  the element the header reports to `nodes`; the header calls the sortable's
 *  activator listeners from its own pointer handlers. While a header is
 *  dragged, dnd-kit moves the others aside with an inline transform, which the
 *  layer writes to their elements: the headers' React styles never set
 *  `transform` or `transition`, so React leaves them alone.
 *
 *  Owns a `DndContext` by default; under an `SfDndProvider` it registers the
 *  headers as a region of the shared context instead. */

import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { DndContext, DragOverlay, rectIntersection } from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { memo, type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import { excludeRegionCollision } from "../dnd/collision";
import { SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../dnd/context";
import type { DragNodes } from "../dnd/nodes";
import { useSfSensors } from "../dnd/sensors";
import { prefersReducedMotion } from "../prefersReducedMotion";

/** A reorderable header, as the layer registers it. */
export interface ColumnReorderHeader {
  /** The sortable id, unique across the whole dnd context (namespace it per
   *  instance: `${regionId}:${columnId}`); also the header's key in `nodes`. */
  id: string;
  /** The real column id, carried in the sortable's data so drag handlers read
   *  it back without parsing the id. */
  columnId: string;
}

export interface ColumnReorderProps {
  /** The headers' region id (from `useId()`), stable for the table's life. */
  regionId: string;
  /** The sortable ids in display order (the sortable list). */
  items: string[];
  /** The headers on screen that take a drag, in render order. */
  headers: ColumnReorderHeader[];
  nodes: DragNodes;
  /** Under a shared provider, leave this region's droppables out of the
   *  headers' collisions (Explorer's tree rows). */
  excludeRegionId?: string;
  onDragStart: (e: DragStartEvent) => void;
  onDragEnd: (e: DragEndEvent) => void;
  onDragCancel: () => void;
  /** A foreign item dropped on a header (shared provider only). */
  onExternalDrop?: (e: DragEndEvent) => void;
  /** The shared provider's overlay for a dragged header, by sortable id. */
  renderOverlay: (activeId: string) => ReactNode;
  /** The own context's overlay: the header being dragged, or nothing. */
  overlay: ReactNode;
}

export function ColumnReorder({
  regionId,
  items,
  headers,
  nodes,
  excludeRegionId,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onExternalDrop,
  renderOverlay,
  overlay,
}: ColumnReorderProps) {
  const shared = useSfDnd();
  // A threshold before a press becomes a drag, so a plain click still sorts
  // and the resize handle still resizes; a finger must rest first (it may be
  // scrolling the table sideways).
  const sensors = useSfSensors();
  const collisionDetection = useMemo(
    () => (excludeRegionId ? excludeRegionCollision(excludeRegionId) : rectIntersection),
    [excludeRegionId],
  );
  useSfDndRegion(shared, {
    id: regionId,
    // dnd-kit's default collision is rectIntersection; keep it under the shared
    // context so column reordering feels identical.
    collisionDetection,
    onDragStart,
    onDragEnd,
    onDragCancel,
    onExternalDrop,
    renderOverlay,
  });

  const sortable = (
    <SortableContext items={items} strategy={horizontalListSortingStrategy}>
      {headers.map((header) => (
        <HeaderBinding
          key={header.id}
          id={header.id}
          columnId={header.columnId}
          // Stamped only under a provider, which routes drags by it.
          regionId={shared ? regionId : undefined}
          nodes={nodes}
        />
      ))}
    </SortableContext>
  );
  // Under a shared provider the DndContext and DragOverlay are the provider's.
  if (shared) return sortable;
  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {sortable}
      <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
    </DndContext>
  );
}

function paint(el: HTMLElement, transform: string, transition: string) {
  el.style.transform = transform;
  el.style.transition = transition;
}

/** One header's sortable, bound to the header element. */
const HeaderBinding = memo(function HeaderBinding({
  id,
  columnId,
  regionId,
  nodes,
}: {
  id: string;
  columnId: string;
  regionId: string | undefined;
  nodes: DragNodes;
}) {
  const { setNodeRef, listeners, transform, transition } = useSortable({
    id,
    data: regionId ? { columnId, [SF_REGION_KEY]: regionId } : { columnId },
  });
  const transformCss = CSS.Transform.toString(transform) ?? "";
  // dnd-kit's settle animation arrives as an inline style, which no CSS
  // reduced-motion block can override; gate it here instead.
  const transitionCss = (prefersReducedMotion() ? undefined : transition) ?? "";

  const el = useRef<HTMLElement | null>(null);
  const style = useRef({ transform: "", transition: "" });
  useLayoutEffect(
    () =>
      nodes.bind(id, (next) => {
        // A header's ref passes `null` and then the same element on every
        // re-render; the transform stays through that, so a drag's settle
        // transition does not restart. A new element takes it over.
        if (next && el.current && el.current !== next) paint(el.current, "", "");
        if (next) {
          el.current = next;
          paint(next, style.current.transform, style.current.transition);
        }
        setNodeRef(next);
      }),
    [nodes, id, setNodeRef],
  );
  useLayoutEffect(() => {
    style.current = { transform: transformCss, transition: transitionCss };
    if (el.current) paint(el.current, transformCss, transitionCss);
  }, [transformCss, transitionCss]);
  // The layer leaving mid-drag (the feature turned off) leaves no transform.
  useLayoutEffect(
    () => () => {
      if (el.current) paint(el.current, "", "");
    },
    [],
  );
  // The header calls these from its own pointer handlers.
  useLayoutEffect(() => nodes.setListeners(id, listeners), [nodes, id, listeners]);
  useLayoutEffect(() => () => nodes.setListeners(id, undefined), [nodes, id]);
  return null;
});
