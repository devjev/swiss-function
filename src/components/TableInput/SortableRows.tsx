/** Drag-to-reorder rows for TableInput, split into its own module so dnd-kit is
 *  loaded lazily (only when `reorderable`). Rows are positional: the dnd id is
 *  the index, which is stable within a single drag; on drop the array is moved
 *  and the parent re-renders in the new order. The reorder layer is intentionally
 *  untyped in the row shape (it only moves array elements), so the generic lives
 *  in TableInput and this stays `unknown`.
 *
 *  Owns its own `DndContext` by default; under an `SfDndProvider` it joins that
 *  shared context instead (see src/lib/dnd). */

import type { Active, DragEndEvent } from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ReactNode, useId } from "react";
import { cx } from "../../lib/cx";
import { SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../../lib/dnd";
import { Glyph } from "../../lib/icons";
import { MoreVertical } from "../Icon";
import styles from "./TableInput.module.css";

/** A host element dropped onto a row (only fires under `SfDndProvider`). */
export interface TableInputExternalDrop {
  /** The dnd-kit active for the dragged host item; read your data off it. */
  active: Active;
  /** Index of the row it was dropped on, or `null` if not over a row. */
  overIndex: number | null;
}

interface SortableRowsProps {
  rows: unknown[];
  onReorder: (rows: unknown[]) => void;
  onExternalDrop?: (drop: TableInputExternalDrop) => void;
  rowClassName?: string;
  handleClassName?: string;
  /** Render a row's inner cells; `handle` is the drag grip to place first. */
  children: (row: unknown, index: number, handle: ReactNode) => ReactNode;
}

export default function SortableRows({
  rows,
  onReorder,
  onExternalDrop,
  rowClassName,
  handleClassName,
  children,
}: SortableRowsProps) {
  const shared = useSfDnd();
  const regionId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = rows.map((_, i) => String(i));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(rows, from, to));
  };

  useSfDndRegion(shared, {
    id: regionId,
    collisionDetection: closestCenter,
    onDragEnd,
    onExternalDrop: ({ active, over }) => {
      const to = over ? ids.indexOf(String(over.id)) : -1;
      onExternalDrop?.({ active, overIndex: to >= 0 ? to : null });
    },
  });

  const list = (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {rows.map((row, index) => (
        <SortableRow
          key={String(index)}
          id={String(index)}
          regionId={regionId}
          className={rowClassName}
          handleClassName={handleClassName}
        >
          {(handle) => children(row, index, handle)}
        </SortableRow>
      ))}
    </SortableContext>
  );

  if (shared) return list;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      {list}
    </DndContext>
  );
}

function SortableRow({
  id,
  regionId,
  className,
  handleClassName,
  children,
}: {
  id: string;
  regionId: string;
  className?: string;
  handleClassName?: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { [SF_REGION_KEY]: regionId } });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={cx(styles.handleCell, styles.handle, handleClassName)}
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <Glyph slot="moreVertical" fallback={MoreVertical} />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      className={cx(className, isDragging && styles.dragging)}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {children(handle)}
    </div>
  );
}
