// Drag-to-reorder rows for ContextEditor, kept in its own module so dnd-kit is
// lazy-loaded (React.lazy + Suspense) and stays out of the base bundle. Mirrors
// TableInput's SortableRows: pointer + keyboard sensors make the reorder
// keyboard-operable, the grip is a real focusable button, the whole row is the
// sortable node.

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
import type { ContextBlock } from "./ContextEditor";

interface ContextEditorRowsProps {
  blocks: ContextBlock[];
  onReorder: (next: ContextBlock[]) => void;
  rowClassName?: string;
  handleClassName?: string;
  hovered: string | null;
  onHover: (id: string | null) => void;
  /** Renders the row cells; the grip handle is passed in as the first child. */
  renderCells: (block: ContextBlock, handle: ReactNode) => ReactNode;
}

export default function ContextEditorRows({
  blocks,
  onReorder,
  rowClassName,
  handleClassName,
  hovered,
  onHover,
  renderCells,
}: ContextEditorRowsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = blocks.map((b) => b.id);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(blocks, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {blocks.map((block) => (
          <SortableRow
            key={block.id}
            block={block}
            rowClassName={rowClassName}
            handleClassName={handleClassName}
            hovered={hovered}
            onHover={onHover}
            renderCells={renderCells}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  block,
  rowClassName,
  handleClassName,
  hovered,
  onHover,
  renderCells,
}: {
  block: ContextBlock;
  rowClassName?: string;
  handleClassName?: string;
  hovered: string | null;
  onHover: (id: string | null) => void;
  renderCells: (block: ContextBlock, handle: ReactNode) => ReactNode;
}) {
  const {
    setNodeRef,
    setActivatorNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={handleClassName}
      aria-label={`Reorder ${block.title}`}
      {...attributes}
      {...listeners}
    />
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: row hover only cross-highlights the gauge; the drag handle and row actions are real buttons
    <div
      ref={setNodeRef}
      className={rowClassName}
      data-hover={hovered === block.id || undefined}
      data-disabled={(block.enabled === false && !block.pinned) || undefined}
      data-dragging={isDragging || undefined}
      onMouseEnter={() => onHover(block.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(block.id)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onHover(null);
      }}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      {renderCells(block, handle)}
    </div>
  );
}
