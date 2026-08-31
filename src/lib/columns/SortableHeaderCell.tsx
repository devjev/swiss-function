/** Column-reorder drag wiring shared by DataTable and Explorer header cells
 *  (issue #28): a render-prop wrapper over dnd-kit's `useSortable`, so a
 *  header cell can be both a grid cell and a sortable item without owning
 *  any dnd-kit plumbing itself. */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties, ReactNode } from "react";
import { SF_REGION_KEY } from "../dnd";
import { prefersReducedMotion } from "../prefersReducedMotion";

/** Drag wiring handed to a header cell. Supplied by {@link SortableHeaderCell},
 *  omitted for static headers. */
export interface HeaderDnd {
  ref: (node: HTMLElement | null) => void;
  /** dnd-kit's a11y attributes (role/aria-roledescription/tabIndex). Spread
   *  them only where a keyboard drag path actually works; the library's tables
   *  keep header cells pointer-drag-only (Enter/Space belongs to sorting), so
   *  they spread `listeners` alone and leave these off rather than announce a
   *  pickup that cannot activate. */
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  style: CSSProperties;
  dragging: boolean;
}

export function SortableHeaderCell({
  id,
  regionId,
  data,
  render,
}: {
  /** The dnd id. Must be unique across the whole dnd context: under an
   *  `SfDndProvider` several widgets share one context, so namespace it per
   *  instance (e.g. `${regionId}:${columnId}`) and carry the real column id in
   *  `data`. */
  id: string;
  /** Shared-dnd region id; stamped on the sortable's data so an `SfDndProvider`
   *  can route this column's drags. Omitted in own-context mode. */
  regionId?: string;
  /** Extra payload merged into the sortable's `data` (e.g. the un-namespaced
   *  column id, so drag handlers read it back without string parsing). */
  data?: Record<string, unknown>;
  render: (dnd: HeaderDnd) => ReactNode;
}) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id,
    data:
      regionId || data
        ? { ...data, ...(regionId ? { [SF_REGION_KEY]: regionId } : null) }
        : undefined,
  });
  return render({
    ref: setNodeRef,
    attributes: attributes as unknown as Record<string, unknown>,
    listeners: listeners as Record<string, unknown> | undefined,
    // dnd-kit's settle animation arrives as an inline style, which no CSS
    // reduced-motion block can override; gate it here instead.
    style: {
      transform: CSS.Transform.toString(transform),
      transition: prefersReducedMotion() ? undefined : transition,
    },
    dragging: isDragging,
  });
}
