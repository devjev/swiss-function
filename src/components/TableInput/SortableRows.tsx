/** Drag-to-reorder rows for TableInput, split into its own module so dnd-kit is
 *  loaded lazily (only when `reorderable`). Rows are positional: the dnd id is
 *  the index, which is stable within a single drag; on drop the array is moved
 *  and the parent re-renders in the new order. The reorder layer is intentionally
 *  untyped in the row shape (it only moves array elements), so the generic lives
 *  in TableInput and this stays `unknown`. */

import type { DragEndEvent } from "@dnd-kit/core";
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
import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { MoreVertical } from "../Icon";
import styles from "./TableInput.module.css";

interface SortableRowsProps {
  rows: unknown[];
  onReorder: (rows: unknown[]) => void;
  rowClassName?: string;
  handleClassName?: string;
  /** Render a row's inner cells; `handle` is the drag grip to place first. */
  children: (row: unknown, index: number, handle: ReactNode) => ReactNode;
}

export default function SortableRows({
  rows,
  onReorder,
  rowClassName,
  handleClassName,
  children,
}: SortableRowsProps) {
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {rows.map((row, index) => (
          <SortableRow
            key={String(index)}
            id={String(index)}
            className={rowClassName}
            handleClassName={handleClassName}
          >
            {(handle) => children(row, index, handle)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  className,
  handleClassName,
  children,
}: {
  id: string;
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
  } = useSortable({ id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={cx(styles.handleCell, styles.handle, handleClassName)}
      aria-label="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <MoreVertical />
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
