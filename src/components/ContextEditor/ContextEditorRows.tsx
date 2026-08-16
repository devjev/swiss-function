// Drag-to-reorder rows for ContextEditor, kept in its own module so dnd-kit is
// lazy-loaded (React.lazy + Suspense) and stays out of the base bundle. Mirrors
// TableInput's SortableRows: pointer + keyboard sensors make the reorder
// keyboard-operable, the grip is a real focusable button, the whole row is the
// sortable node. Owns its own `DndContext`, or joins an `SfDndProvider` when one
// wraps it (see src/lib/dnd).

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
import { SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../../lib/dnd";
import type { ContextBlock } from "./ContextEditor";

/** A host element dropped onto a block row (only fires under `SfDndProvider`). */
export interface ContextEditorExternalDrop {
  /** The dnd-kit active for the dragged host item; read your data off it. */
  active: Active;
  /** Id of the block it was dropped on, or `null` if not over a block. */
  overId: string | null;
}

interface ContextEditorRowsProps {
  blocks: ContextBlock[];
  onReorder: (next: ContextBlock[]) => void;
  onExternalDrop?: (drop: ContextEditorExternalDrop) => void;
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
  onExternalDrop,
  rowClassName,
  handleClassName,
  hovered,
  onHover,
  renderCells,
}: ContextEditorRowsProps) {
  const shared = useSfDnd();
  const regionId = useId();
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

  useSfDndRegion(shared, {
    id: regionId,
    collisionDetection: closestCenter,
    onDragEnd,
    onExternalDrop: ({ active, over }) => {
      const overId = over && ids.includes(String(over.id)) ? String(over.id) : null;
      onExternalDrop?.({ active, overId });
    },
  });

  const list = (
    <SortableContext items={ids} strategy={verticalListSortingStrategy}>
      {blocks.map((block) => (
        <SortableRow
          key={block.id}
          block={block}
          regionId={regionId}
          rowClassName={rowClassName}
          handleClassName={handleClassName}
          hovered={hovered}
          onHover={onHover}
          renderCells={renderCells}
        />
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
  block,
  regionId,
  rowClassName,
  handleClassName,
  hovered,
  onHover,
  renderCells,
}: {
  block: ContextBlock;
  regionId: string;
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
  } = useSortable({ id: block.id, data: { [SF_REGION_KEY]: regionId } });

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
