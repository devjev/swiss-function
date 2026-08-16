// Drag-to-reorder tree for AgentComposer, in its own module so dnd-kit is
// lazy-loaded (React.lazy + Suspense) and stays out of the base bundle. Only
// pointer drag lives here; keyboard reordering (Alt+Arrows) is handled by the
// owning component, so no dnd-kit KeyboardSensor is needed. Each node's header
// is the drag activator (the chevron stops pointer propagation, so toggling a
// node never starts a drag). Reordering is within a parent's children only; a
// cross-parent drop is ignored (reorderSiblings returns identity).

import type { Active, CollisionDetection, DragEndEvent } from "@dnd-kit/core";
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type ReactNode, useId } from "react";
import { SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../../lib/dnd";
import { type AgentComposerAgent, type AgentComposerNode, siblingIds } from "./composer";
import { type NodeCtx, renderNode } from "./renderNode";

/** A host element dropped onto a tree node (only fires under `SfDndProvider`). */
export interface AgentComposerExternalDrop {
  /** The dnd-kit active for the dragged host item; read your data off it. */
  active: Active;
  /** Id of the node it was dropped on, or `null` if not over a node. */
  overId: string | null;
}

interface AgentComposerTreeProps {
  ctx: NodeCtx;
  root: AgentComposerAgent;
  onReorder: (activeId: string, overId: string) => void;
  onExternalDrop?: (drop: AgentComposerExternalDrop) => void;
}

const wrapGroup = (childIds: string[], children: ReactNode) => (
  <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
    {children}
  </SortableContext>
);

export default function AgentComposerTree({
  ctx,
  root,
  onReorder,
  onExternalDrop,
}: AgentComposerTreeProps) {
  const shared = useSfDnd();
  const regionId = useId();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  };

  // Restrict drop targets to the dragged node's siblings, so an expanded
  // target's children can't win the collision and reordering stays within one
  // parent (the honest read: a node moves among its peers, never across).
  const collisionDetection: CollisionDetection = (args) => {
    const activeId = args.active?.id != null ? String(args.active.id) : null;
    if (!activeId) return closestCenter(args);
    const sibs = new Set(siblingIds(root, activeId));
    const droppableContainers = args.droppableContainers.filter((c) => sibs.has(String(c.id)));
    return closestCenter({ ...args, droppableContainers });
  };

  useSfDndRegion(shared, {
    id: regionId,
    collisionDetection,
    onDragEnd,
    onExternalDrop: ({ active, over }) => {
      onExternalDrop?.({ active, overId: over ? String(over.id) : null });
    },
  });

  // The root is not sortable (it has no siblings); only its descendants are.
  const tree = renderNode(
    ctx,
    root,
    0,
    true,
    (child, _i, last) => (
      <SortableNode
        key={child.id}
        ctx={ctx}
        node={child}
        depth={1}
        regionId={regionId}
        isLast={last}
      />
    ),
    wrapGroup,
  );

  if (shared) return <>{tree}</>;

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragEnd={onDragEnd}>
      {tree}
    </DndContext>
  );
}

function SortableNode({
  ctx,
  node,
  depth,
  regionId,
  isLast,
}: {
  ctx: NodeCtx;
  node: AgentComposerNode;
  depth: number;
  regionId: string;
  isLast: boolean;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } =
    useSortable({ id: node.id, data: { [SF_REGION_KEY]: regionId } });

  return renderNode(
    ctx,
    node,
    depth,
    isLast,
    (child, _i, last) => (
      <SortableNode
        key={child.id}
        ctx={ctx}
        node={child}
        depth={depth + 1}
        regionId={regionId}
        isLast={last}
      />
    ),
    wrapGroup,
    {
      section: {
        ref: setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        dragging: isDragging,
      },
      head: { ref: setActivatorNodeRef, listeners },
    },
  );
}
