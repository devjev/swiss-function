// The single shared dnd-kit context. See context.ts for the routing model.
//
// One `DndContext` + one `DragOverlay` serve every swiss-function widget in the
// subtree plus the host's own draggables/droppables. The provider owns no drag
// behaviour of its own; it dispatches each event to the region that owns the
// active item (by `sfRegionId` in the item data). A drop within the item's own
// region reorders it there; a drop over a DIFFERENT region — or a foreign (host)
// item dropped over a region — fires the TARGET region's `onExternalDrop`, so a
// row can be dragged out of one widget onto another. Drags claimed by no region
// fall through to the optional top-level handler props, so a host can run its own
// sortables under the same context.

import type {
  CollisionDetection,
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  SensorDescriptor,
} from "@dnd-kit/core";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  regionIdOf,
  routeDragEnd,
  SfDndProviderContext,
  type SfDndRegion,
  type SfDndRegistry,
} from "./context";

export interface SfDndProviderProps {
  children: ReactNode;
  /** Override the sensor set. Defaults to pointer (4px activation) + keyboard. */
  sensors?: SensorDescriptor<Record<string, unknown>>[];
  /** Handle drags claimed by no region (the host's own sortables). */
  onDragStart?: (e: DragStartEvent) => void;
  onDragMove?: (e: DragMoveEvent) => void;
  onDragOver?: (e: DragOverEvent) => void;
  onDragEnd?: (e: DragEndEvent) => void;
  onDragCancel?: (e: DragCancelEvent) => void;
  /** Overlay for a dragged foreign item (one with no region). Region drags use
   *  the region's own overlay. */
  renderOverlay?: (activeId: string) => ReactNode;
}

interface ActiveState {
  id: string;
  regionId: string | null;
}

export function SfDndProvider({
  children,
  sensors: sensorsProp,
  onDragStart,
  onDragMove,
  onDragOver,
  onDragEnd,
  onDragCancel,
  renderOverlay,
}: SfDndProviderProps) {
  const regions = useRef(new Map<string, SfDndRegion>());
  const [active, setActive] = useState<ActiveState | null>(null);

  // Keep top-level handler props reachable from the stable callbacks below.
  const propsRef = useRef({
    onDragStart,
    onDragMove,
    onDragOver,
    onDragEnd,
    onDragCancel,
    renderOverlay,
  });
  propsRef.current = {
    onDragStart,
    onDragMove,
    onDragOver,
    onDragEnd,
    onDragCancel,
    renderOverlay,
  };

  const registry = useMemo<SfDndRegistry>(
    () => ({
      register: (region) => regions.current.set(region.id, region),
      unregister: (id) => regions.current.delete(id),
    }),
    [],
  );

  const defaultSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sensors = sensorsProp ?? defaultSensors;

  // The active region's strategy for its own drags; closestCenter for a foreign
  // drag so a host item can collide with any widget's droppables.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const region = regionIdOf(args.active)
      ? regions.current.get(regionIdOf(args.active) as string)
      : null;
    return (region?.collisionDetection ?? closestCenter)(args);
  }, []);

  /** A drag is claimed when its active item carries a registered region id.
   *  The top-level handler props are documented to fire only for unclaimed
   *  (host-owned) drags, so every dispatch below gates on this — a host that
   *  tracks drag state via onDragStart/onDragEnd must see a consistent
   *  start/move/over/end/cancel set, never a start with no end. */
  const isClaimed = useCallback((regionId: string | null): regionId is string => {
    return regionId != null && regions.current.has(regionId);
  }, []);

  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      const regionId = regionIdOf(e.active);
      setActive({ id: String(e.active.id), regionId });
      if (isClaimed(regionId)) regions.current.get(regionId)?.onDragStart?.(e);
      else propsRef.current.onDragStart?.(e);
    },
    [isClaimed],
  );

  const handleDragMove = useCallback(
    (e: DragMoveEvent) => {
      const regionId = regionIdOf(e.active);
      if (isClaimed(regionId)) regions.current.get(regionId)?.onDragMove?.(e);
      else propsRef.current.onDragMove?.(e);
    },
    [isClaimed],
  );

  const handleDragOver = useCallback(
    (e: DragOverEvent) => {
      const regionId = regionIdOf(e.active);
      if (isClaimed(regionId)) regions.current.get(regionId)?.onDragOver?.(e);
      else propsRef.current.onDragOver?.(e);
    },
    [isClaimed],
  );

  const handleDragEnd = useCallback(
    (e: DragEndEvent) => {
      setActive(null);
      const activeRegionId = regionIdOf(e.active);
      const claimed = isClaimed(activeRegionId);
      const route = routeDragEnd(activeRegionId, regionIdOf(e.over), (id) =>
        regions.current.has(id),
      );
      if (route.kind === "internal") {
        // The region's handler reorders and cleans up (it self-guards on `over`,
        // so a drop over nothing or another region is a no-op).
        regions.current.get(route.regionId)?.onDragEnd?.(e);
        return;
      }
      if (route.kind === "external") {
        // A foreign item lands on the target region's `onExternalDrop`.
        regions.current.get(route.regionId)?.onExternalDrop?.(e);
        // On a cross-region drag-OUT (the item owns a different registered region),
        // the source region got no terminal event for its own drag, so its
        // transient drag state (the ghosted source row) would leak. Reset it via
        // the source's cancel handler — a pure reset that runs no reorder. A host
        // item (`activeRegionId === null`) has no source region to reset.
        if (claimed && activeRegionId !== route.regionId) {
          regions.current.get(activeRegionId)?.onDragCancel?.(e);
        }
      }
      // The host's terminal event, for host-owned drags only: a widget-internal
      // reorder or drag-out never leaks to the host handlers.
      if (!claimed) propsRef.current.onDragEnd?.(e);
    },
    [isClaimed],
  );

  const handleDragCancel = useCallback(
    (e: DragCancelEvent) => {
      setActive(null);
      const regionId = regionIdOf(e.active);
      if (isClaimed(regionId)) regions.current.get(regionId)?.onDragCancel?.(e);
      else propsRef.current.onDragCancel?.(e);
    },
    [isClaimed],
  );

  // The host's renderOverlay serves unclaimed (host-owned) drags only. A region
  // drag whose widget registered no overlay renders nothing — those widgets
  // drag via an in-place sortable transform, and the host's foreign-item ghost
  // (built from an id the host never issued) must not shadow it.
  const overlay = active
    ? active.regionId
      ? (regions.current.get(active.regionId)?.renderOverlay?.(active.id) ?? null)
      : (propsRef.current.renderOverlay?.(active.id) ?? null)
    : null;

  return (
    <SfDndProviderContext value={registry}>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragMove={handleDragMove}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}
        <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
      </DndContext>
    </SfDndProviderContext>
  );
}
