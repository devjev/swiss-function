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
import { regionIdOf, SF_REGION_KEY, useSfDnd, useSfDndRegion } from "../../lib/dnd";
import { prefersReducedMotion } from "../../lib/prefersReducedMotion";
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

// SortableContext items must match the sortables' namespaced dnd ids, so the
// group wrapper is built per instance from its region id.
const wrapGroupFor = (regionId: string) => (childIds: string[], children: ReactNode) => (
  <SortableContext
    items={childIds.map((id) => `${regionId}:${id}`)}
    strategy={verticalListSortingStrategy}
  >
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

  // Namespace the dnd ids per region: under one `SfDndProvider` every widget
  // shares a single dnd-kit context, so two composers holding the same node id
  // would resolve a drag to the wrong widget. Consumer-facing payloads
  // (onReorder, onExternalDrop.overId) stay real node ids.
  const prefix = `${regionId}:`;
  const realId = (dndId: unknown): string | null => {
    const s = String(dndId);
    return s.startsWith(prefix) ? s.slice(prefix.length) : null;
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const activeId = realId(active.id);
    const overId = realId(over.id);
    if (activeId == null || overId == null) return;
    onReorder(activeId, overId);
  };

  // Restrict drop targets to the dragged node's siblings, so an expanded
  // target's children can't win the collision and reordering stays within one
  // parent (the honest read: a node moves among its peers, never across). The
  // sibling filter only applies to this region's own containers: foreign ones
  // (another widget's rows, a host droppable) stay in, so a drag out of the
  // tree can land on them under a shared provider. Own-context mode only ever
  // registers this region's containers, so it behaves as before.
  const collisionDetection: CollisionDetection = (args) => {
    const activeId = args.active?.id != null ? realId(args.active.id) : null;
    if (activeId == null) return closestCenter(args);
    const sibs = new Set(siblingIds(root, activeId).map((id) => `${prefix}${id}`));
    const droppableContainers = args.droppableContainers.filter(
      (c) => sibs.has(String(c.id)) || regionIdOf(c) !== regionId,
    );
    return closestCenter({ ...args, droppableContainers });
  };

  useSfDndRegion(shared, {
    id: regionId,
    collisionDetection,
    onDragEnd,
    onExternalDrop: ({ active, over }) => {
      onExternalDrop?.({ active, overId: over ? realId(over.id) : null });
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
    wrapGroupFor(regionId),
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
  // The real node id rides in `data` so a foreign drop target can identify
  // the dragged node behind the namespaced dnd id.
  const { setNodeRef, setActivatorNodeRef, listeners, transform, transition, isDragging } =
    useSortable({
      id: `${regionId}:${node.id}`,
      data: { [SF_REGION_KEY]: regionId, nodeId: node.id },
    });

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
    wrapGroupFor(regionId),
    {
      section: {
        ref: setNodeRef,
        style: {
          transform: CSS.Transform.toString(transform),
          // dnd-kit's settle transition is an inline style, so it must be
          // gated here; the reduced-motion media query cannot reach it.
          transition: prefersReducedMotion() ? undefined : transition,
        },
        dragging: isDragging,
      },
      head: { ref: setActivatorNodeRef, listeners },
    },
  );
}
