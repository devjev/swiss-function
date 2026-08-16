// Shared drag-and-drop context for the library. Every sortable widget
// (DataTable, Explorer, WindowArray, TableInput, ContextEditor, AgentComposer)
// renders its own dnd-kit `DndContext` by default. When a host app wraps a
// subtree in `SfDndProvider`, those widgets instead join the provider's single
// `DndContext`: one dnd-kit runtime, no nested contexts, and the host can drag
// its own elements onto a widget's rows/nodes.
//
// The provider can't carry one fixed dnd config, because sensors, collision
// detection, drag handlers and the DragOverlay differ per widget. So each widget
// registers a `region` describing its behaviour, and the provider routes each
// drag to the right region by the `sfRegionId` stamped on the dragged/target
// item's `data` (see `SF_REGION_KEY`).

import type {
  CollisionDetection,
  DragCancelEvent,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import { closestCenter } from "@dnd-kit/core";
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";

/** The key under a draggable/droppable item's `data` that names its region.
 *  Stamp every sortable item with `data: { [SF_REGION_KEY]: regionId }` so the
 *  provider can route drags to the owning widget. */
export const SF_REGION_KEY = "sfRegionId" as const;

/** Read the region id an item belongs to, or `null` for a foreign (host) item. */
export function regionIdOf(
  node: { data?: { current?: Record<string, unknown> | undefined } } | null | undefined,
): string | null {
  const id = node?.data?.current?.[SF_REGION_KEY];
  return typeof id === "string" ? id : null;
}

/** Where a completed drag should go. `internal`: reorder within the active
 *  item's own region. `external`: a foreign item dropped over a region (that
 *  region's `onExternalDrop`). `none`: unclaimed — the host's own drag. */
export type DragRoute =
  | { kind: "internal"; regionId: string }
  | { kind: "external"; regionId: string }
  | { kind: "none" };

/** Decide the route for a drag from `activeRegionId`, dropped over
 *  `overRegionId`. A drag owned by a registered region is always internal (its
 *  handler self-guards on the drop target); otherwise a drop over a registered
 *  region is external; otherwise unclaimed. Pure, so it is unit-tested directly. */
export function routeDragEnd(
  activeRegionId: string | null,
  overRegionId: string | null,
  hasRegion: (id: string) => boolean,
): DragRoute {
  if (activeRegionId && hasRegion(activeRegionId)) {
    return { kind: "internal", regionId: activeRegionId };
  }
  if (overRegionId && hasRegion(overRegionId)) {
    return { kind: "external", regionId: overRegionId };
  }
  return { kind: "none" };
}

/** One widget's drag behaviour, registered with an `SfDndProvider`. Only `id` is
 *  required; the provider falls back to sensible defaults for the rest. */
export interface SfDndRegion {
  /** Unique per widget instance (use `useId()`), matching the item `data`. */
  id: string;
  /** Collision strategy for drags that originate in this region. */
  collisionDetection?: CollisionDetection;
  onDragStart?: (e: DragStartEvent) => void;
  onDragMove?: (e: DragMoveEvent) => void;
  onDragOver?: (e: DragOverEvent) => void;
  /** Fires when a drag that started in this region ends (internal reorder). The
   *  widget's existing handler already self-guards on `over`, so it also handles
   *  cleanup on a drop over nothing. */
  onDragEnd?: (e: DragEndEvent) => void;
  onDragCancel?: (e: DragCancelEvent) => void;
  /** Fires when a foreign item (host element or another region) is dropped over
   *  this region's droppables. */
  onExternalDrop?: (e: DragEndEvent) => void;
  /** Rendered in the provider's single `DragOverlay` while a drag from this
   *  region is active. */
  renderOverlay?: (activeId: string) => ReactNode;
}

/** The registry a widget talks to. `null` outside a provider (own-context mode). */
export interface SfDndRegistry {
  register: (region: SfDndRegion) => void;
  unregister: (id: string) => void;
}

const SfDndContext = createContext<SfDndRegistry | null>(null);

export const SfDndProviderContext = SfDndContext.Provider;

/** Returns the shared registry when inside an `SfDndProvider`, else `null`. A
 *  widget uses the result to decide between joining the shared context and
 *  rendering its own. */
export function useSfDnd(): SfDndRegistry | null {
  return useContext(SfDndContext);
}

/** Register a widget's region with the shared provider for its lifetime. Handlers
 *  close over live props/state, so this registers a stable forwarder that reads
 *  the latest `region` through a ref: one register/unregister per mount, no churn
 *  as the widget re-renders. No-op when `registry` is `null`.
 *
 *  `region.id` must be stable across renders (derive it from `useId()`). */
export function useSfDndRegion(registry: SfDndRegistry | null, region: SfDndRegion): void {
  const ref = useRef(region);
  ref.current = region;

  useEffect(() => {
    if (!registry) return;
    const id = ref.current.id;
    const stable: SfDndRegion = {
      id,
      collisionDetection: (args) => (ref.current.collisionDetection ?? closestCenter)(args),
      onDragStart: (e) => ref.current.onDragStart?.(e),
      onDragMove: (e) => ref.current.onDragMove?.(e),
      onDragOver: (e) => ref.current.onDragOver?.(e),
      onDragEnd: (e) => ref.current.onDragEnd?.(e),
      onDragCancel: (e) => ref.current.onDragCancel?.(e),
      onExternalDrop: (e) => ref.current.onExternalDrop?.(e),
      renderOverlay: (activeId) => ref.current.renderOverlay?.(activeId),
    };
    registry.register(stable);
    return () => registry.unregister(id);
    // region.id is required to be stable; other fields are read live via the ref.
  }, [registry]);
}
